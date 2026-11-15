"""
Placement calendar.

One table serves two audiences. The placement cell sees every entry except
other people's personal reminders, and uses POC assignment and the clash
warnings to coordinate. Students see what the cell chose to share with them
(everyone, their batch/branch, or them by name) plus their own reminders.
Who-sees-what lives in `services/calendar.py`; this module loads rows and
enforces who may write what.

Nothing is cached: every response depends on the viewer (see the 2026-09-20
decision on per-viewer cache keys).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, distinct, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    PERM_CALENDAR_MANAGE,
    PERM_CALENDAR_VIEW,
    get_current_user,
    has_any_admin_permission,
    has_permission,
    is_elevated_role,
    require_permission,
)
from app.dependencies import get_db
from app.models.db import (
    Application,
    ApplicationStatus,
    CalendarEvent,
    CalendarEventAttendee,
    CalendarEventPoc,
    CalendarEventType,
    CalendarVisibility,
    Company,
    JobProfile,
    JobStatus,
    Role,
    User,
)
from app.schemas.calendar import (
    CalendarCompanyOption,
    CalendarEventResponse,
    CalendarEventSaveResponse,
    CalendarEventWrite,
    CalendarJobOption,
    CalendarOptionsResponse,
    CalendarPerson,
)
from app.services.calendar import (
    MAX_EVENT_DURATION,
    MAX_RANGE,
    EventSlot,
    StudentContext,
    find_conflicts,
    student_can_see,
    to_utc,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def is_staff_viewer(caller: dict) -> bool:
    """
    Whether the caller sees the placement cell's view of the calendar.

    `calendar.view` alone is not enough: students hold it too. The same shape
    as `_may_see_drafts` in announcements.py.
    """
    return has_any_admin_permission(caller) and has_permission(caller, PERM_CALENDAR_VIEW)


def can_edit_event(caller: dict, event_type: str, created_by_id: str) -> bool:
    """A personal reminder belongs to its author alone; everything else to calendar.manage."""
    if event_type == CalendarEventType.PERSONAL.value:
        return created_by_id == caller.get("sub")
    return has_permission(caller, PERM_CALENDAR_MANAGE)


def _person(user: User | None) -> CalendarPerson | None:
    if user is None:
        return None
    return CalendarPerson(
        id=user.id,
        name=user.name,
        email=user.email,
        rollNumber=user.rollNumber,
        branch=user.branch,
        batch=user.batch,
    )


def _to_response(event: CalendarEvent, caller: dict, *, staff_view: bool) -> CalendarEventResponse:
    me = caller.get("sub")
    attendee_users = [a.user for a in event.attendees] if staff_view else []
    attendee_ids = {a.userId for a in event.attendees}
    pocs = [p for p in (_person(poc.user) for poc in event.pocs) if p is not None]
    if not staff_view:
        # Students get a POC's name and email so they know whom to ask; roll
        # numbers and batches of staff accounts are not theirs to see.
        pocs = [CalendarPerson(id=p.id, name=p.name, email=p.email) for p in pocs]
    event_type = _enum_value(event.type)
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        type=event_type,
        startsAt=to_utc(event.startsAt),
        endsAt=to_utc(event.endsAt),
        allDay=bool(event.allDay),
        location=event.location,
        meetingLink=event.meetingLink,
        companyId=event.companyId,
        companyName=event.company.name if event.company else None,
        jobProfileId=event.jobProfileId,
        jobTitle=event.job_profile.title if event.job_profile else None,
        visibility=_enum_value(event.visibility),
        targetBatches=list(event.targetBatches or []),
        targetBranches=list(event.targetBranches or []),
        createdById=event.createdById,
        createdByName=(event.created_by.name if event.created_by else None) if staff_view else None,
        pocs=pocs,
        attendees=[p for p in (_person(u) for u in attendee_users) if p is not None] if staff_view else None,
        attendeeCount=len(attendee_ids) if staff_view else 0,
        isAttendee=me in attendee_ids,
        canEdit=can_edit_event(caller, event_type, event.createdById),
        createdAt=to_utc(event.createdAt),
        updatedAt=to_utc(event.updatedAt),
    )


def _loaded(stmt):
    return stmt.options(
        selectinload(CalendarEvent.company),
        selectinload(CalendarEvent.job_profile),
        selectinload(CalendarEvent.created_by),
        selectinload(CalendarEvent.pocs).selectinload(CalendarEventPoc.user),
        selectinload(CalendarEvent.attendees).selectinload(CalendarEventAttendee.user),
    )


def _require_calendar_view(caller: dict) -> None:
    if not has_permission(caller, PERM_CALENDAR_VIEW):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{PERM_CALENDAR_VIEW}' is required for this resource.",
        )


async def _student_context(db: AsyncSession, caller: dict) -> StudentContext:
    # Batch and branch come from the database, not the token: a roster
    # correction must take effect without the student signing in again.
    user = await db.get(User, caller.get("sub"))
    if user is None:
        return StudentContext(id=caller.get("sub", ""), batch=None, branch=None)
    return StudentContext(id=user.id, batch=user.batch, branch=user.branch)


def _visible_to(event: CalendarEvent, caller: dict, staff_view: bool, student: StudentContext | None) -> bool:
    visibility = _enum_value(event.visibility)
    if visibility == CalendarVisibility.PRIVATE.value:
        return event.createdById == caller.get("sub")
    if staff_view:
        return True
    assert student is not None
    return student_can_see(
        visibility=visibility,
        created_by_id=event.createdById,
        target_batches=list(event.targetBatches or []),
        target_branches=list(event.targetBranches or []),
        attendee_ids={a.userId for a in event.attendees},
        student=student,
    )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

@router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    from_: datetime = Query(..., alias="from", description="Start of the visible range (inclusive)"),
    to: datetime = Query(..., description="End of the visible range (exclusive)"),
    companyId: Optional[str] = Query(None),
    pocId: Optional[str] = Query(None, description="Only events this staff member is POC for (staff only)"),
    type: Optional[str] = Query(None),
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Every entry overlapping [from, to) that the caller may see."""
    _require_calendar_view(caller)
    start, end = to_utc(from_), to_utc(to)
    if end <= start:
        raise HTTPException(status_code=400, detail="'to' must be after 'from'.")
    if end - start > MAX_RANGE:
        raise HTTPException(status_code=400, detail="Calendar range is limited to 100 days.")

    me = caller.get("sub")
    staff_view = is_staff_viewer(caller)

    stmt = _loaded(select(CalendarEvent)).where(
        CalendarEvent.startsAt < end, CalendarEvent.endsAt > start
    )

    if staff_view:
        stmt = stmt.where(
            or_(
                CalendarEvent.visibility != CalendarVisibility.PRIVATE,
                CalendarEvent.createdById == me,
            )
        )
        if pocId:
            stmt = stmt.where(
                exists().where(
                    CalendarEventPoc.eventId == CalendarEvent.id, CalendarEventPoc.userId == pocId
                )
            )
    else:
        # A coarse SQL cut; TARGETED rows are then checked against the
        # student's batch and branch by student_can_see, the one place that
        # rule lives.
        stmt = stmt.where(
            or_(
                CalendarEvent.visibility.in_([CalendarVisibility.STUDENTS, CalendarVisibility.TARGETED]),
                and_(
                    CalendarEvent.visibility == CalendarVisibility.ATTENDEES,
                    exists().where(
                        CalendarEventAttendee.eventId == CalendarEvent.id,
                        CalendarEventAttendee.userId == me,
                    ),
                ),
                and_(
                    CalendarEvent.visibility == CalendarVisibility.PRIVATE,
                    CalendarEvent.createdById == me,
                ),
            )
        )

    if companyId:
        stmt = stmt.where(CalendarEvent.companyId == companyId)
    if type:
        try:
            stmt = stmt.where(CalendarEvent.type == CalendarEventType(type))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown event type '{type}'.")

    stmt = stmt.order_by(CalendarEvent.startsAt.asc(), CalendarEvent.title.asc()).limit(2000)
    events = (await db.scalars(stmt)).all()

    student = None if staff_view else await _student_context(db, caller)
    return [
        _to_response(e, caller, staff_view=staff_view)
        for e in events
        if _visible_to(e, caller, staff_view, student)
    ]


@router.get("/options", response_model=CalendarOptionsResponse)
async def calendar_options(
    caller: dict = Depends(require_permission(PERM_CALENDAR_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Everything the staff event form needs to fill its pickers, in one round trip."""
    staff = (
        await db.scalars(
            select(User)
            .where(
                User.role.in_([Role.PLACEMENT_VOLUNTEER, Role.PLACEMENT_TEAM, Role.SUPER_ADMIN]),
                User.isActive.is_(True),
            )
            .order_by(User.name.asc().nulls_last(), User.email.asc())
        )
    ).all()
    students = (
        await db.scalars(
            select(User)
            .where(User.role == Role.STUDENT, User.isActive.is_(True))
            .order_by(User.name.asc().nulls_last(), User.rollNumber.asc())
            .limit(3000)
        )
    ).all()
    companies = (await db.scalars(select(Company).order_by(Company.name.asc()))).all()
    jobs = (
        await db.scalars(
            select(JobProfile)
            .options(selectinload(JobProfile.company))
            .where(JobProfile.status != JobStatus.ENDED)
            .order_by(JobProfile.createdAt.desc())
            .limit(300)
        )
    ).all()
    batches = (
        await db.scalars(
            select(distinct(User.batch))
            .where(User.role == Role.STUDENT, User.batch.is_not(None))
            .order_by(User.batch.desc())
        )
    ).all()
    branches = (
        await db.scalars(
            select(distinct(User.branch))
            .where(User.role == Role.STUDENT, User.branch.is_not(None), User.branch != "")
            .order_by(User.branch.asc())
        )
    ).all()

    return CalendarOptionsResponse(
        staff=[CalendarPerson(id=u.id, name=u.name, email=u.email) for u in staff],
        students=[p for p in (_person(u) for u in students) if p is not None],
        companies=[CalendarCompanyOption(id=c.id, name=c.name) for c in companies],
        jobs=[
            CalendarJobOption(
                id=j.id,
                title=j.title,
                companyId=j.companyId,
                companyName=j.company.name if j.company else None,
                status=_enum_value(j.status),
            )
            for j in jobs
        ],
        batches=[b for b in batches if b is not None],
        branches=[b for b in branches if b],
    )


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def check_write_rules(payload: CalendarEventWrite, caller: dict) -> None:
    """
    The rules that need nothing but the payload and the caller. Kept apart
    from the database checks so they can be tested without one.
    """
    is_personal = payload.type == CalendarEventType.PERSONAL.value
    is_private = payload.visibility == CalendarVisibility.PRIVATE.value
    if is_personal != is_private:
        raise HTTPException(
            status_code=400,
            detail="Personal reminders are always private, and only personal reminders can be private.",
        )
    if not is_personal and not has_permission(caller, PERM_CALENDAR_MANAGE):
        raise HTTPException(
            status_code=403,
            detail="Only the placement cell can add shared calendar entries. You can add personal reminders.",
        )

    start, end = to_utc(payload.startsAt), to_utc(payload.endsAt)
    if end < start:
        raise HTTPException(status_code=400, detail="The end time must not be before the start time.")
    if end - start > MAX_EVENT_DURATION:
        raise HTTPException(status_code=400, detail="A calendar entry can last at most 14 days.")

    if payload.visibility == CalendarVisibility.TARGETED.value and not (
        payload.targetBatches or payload.targetBranches
    ):
        raise HTTPException(
            status_code=400,
            detail="Pick at least one batch or branch, or share the entry with all students.",
        )
    if payload.visibility == CalendarVisibility.ATTENDEES.value and not (
        payload.attendeeIds or payload.attendeesFromJob
    ):
        raise HTTPException(status_code=400, detail="Add at least one student to this entry.")


async def _company_by_name(db: AsyncSession, name: str) -> str:
    """
    The id of the company called `name`, creating a minimal row if none exists.

    The calendar is mostly used for recruiters visiting for the first time, so
    making the office leave the form to register a company first would defeat
    it. A case-insensitive match reuses an existing row ("amazon" is Amazon).
    A new row carries only its name; category, session and description are
    filled in later from Companies, the same trade the offers screen makes
    for an off-campus recruiter (resolveCompanyId in placement-records).
    """
    name = " ".join(name.split())
    existing = (
        await db.scalars(select(Company).where(func.lower(Company.name) == name.lower()).limit(1))
    ).first()
    if existing is not None:
        return existing.id
    company = Company(id=str(uuid.uuid4()), name=name, createdAt=datetime.now(timezone.utc))
    db.add(company)
    await db.flush()
    return company.id


async def _resolve_links(db: AsyncSession, payload: CalendarEventWrite) -> tuple[str | None, str | None]:
    company_id, job_id = payload.companyId, payload.jobProfileId
    if not company_id and payload.companyName:
        # A personal reminder never writes to the company register: only the
        # placement cell (calendar.manage, already checked for every
        # non-personal entry) adds recruiters.
        if payload.type == CalendarEventType.PERSONAL.value:
            raise HTTPException(status_code=400, detail="Personal reminders cannot add a new company.")
        company_id = await _company_by_name(db, payload.companyName)
    if job_id:
        job = await db.get(JobProfile, job_id)
        if job is None:
            raise HTTPException(status_code=400, detail="That drive no longer exists.")
        if company_id and company_id != job.companyId:
            raise HTTPException(status_code=400, detail="The drive belongs to a different company.")
        company_id = job.companyId
    if company_id and await db.get(Company, company_id) is None:
        raise HTTPException(status_code=400, detail="That company no longer exists.")
    return company_id, job_id


async def _resolve_pocs(db: AsyncSession, poc_ids: list[str]) -> list[str]:
    if not poc_ids:
        return []
    users = (await db.scalars(select(User).where(User.id.in_(poc_ids)))).all()
    valid = {u.id for u in users if is_elevated_role(_enum_value(u.role)) and u.isActive}
    missing = [i for i in poc_ids if i not in valid]
    if missing:
        raise HTTPException(status_code=400, detail="Every POC must be an active placement-cell account.")
    return poc_ids


async def _resolve_attendees(db: AsyncSession, payload: CalendarEventWrite) -> list[str]:
    ids = list(payload.attendeeIds)
    if payload.attendeesFromJob:
        source = payload.attendeesFromJob
        applicant_ids = (
            await db.scalars(
                select(Application.userId).where(
                    Application.jobProfileId == source.jobProfileId,
                    Application.status.in_([ApplicationStatus(s) for s in source.statuses]),
                )
            )
        ).all()
        ids.extend(applicant_ids)
    ids = list(dict.fromkeys(ids))
    if not ids:
        if payload.visibility == CalendarVisibility.ATTENDEES.value:
            raise HTTPException(
                status_code=400,
                detail="No students matched. Add students by name, or pick stages that have applicants.",
            )
        return []
    students = (
        await db.scalars(select(User.id).where(User.id.in_(ids), User.role == Role.STUDENT))
    ).all()
    found = set(students)
    if len(found) != len(ids):
        raise HTTPException(status_code=400, detail="Every attendee must be a student account.")
    return ids


async def _conflict_warnings(db: AsyncSession, event: CalendarEvent) -> list[str]:
    if _enum_value(event.type) == CalendarEventType.PERSONAL.value:
        return []
    start, end = to_utc(event.startsAt), to_utc(event.endsAt)
    others = (
        await db.scalars(
            select(CalendarEvent)
            .options(
                selectinload(CalendarEvent.company),
                selectinload(CalendarEvent.pocs).selectinload(CalendarEventPoc.user),
            )
            .where(
                CalendarEvent.id != event.id,
                CalendarEvent.visibility != CalendarVisibility.PRIVATE,
                CalendarEvent.startsAt < end,
                CalendarEvent.endsAt > start,
            )
            .limit(200)
        )
    ).all()

    def slot(e: CalendarEvent) -> EventSlot:
        return EventSlot(
            id=e.id,
            title=e.title,
            starts_at=e.startsAt,
            ends_at=e.endsAt,
            company_id=e.companyId,
            company_name=e.company.name if e.company else None,
            pocs={p.userId: (p.user.name or p.user.email or "A POC") if p.user else "A POC" for p in e.pocs},
        )

    return find_conflicts(slot(event), [slot(o) for o in others])


async def _apply(
    db: AsyncSession, event: CalendarEvent, payload: CalendarEventWrite
) -> None:
    is_personal = payload.type == CalendarEventType.PERSONAL.value
    company_id, job_id = await _resolve_links(db, payload)
    poc_ids = [] if is_personal else await _resolve_pocs(db, payload.pocIds)
    attendee_ids = (
        await _resolve_attendees(db, payload)
        if payload.visibility == CalendarVisibility.ATTENDEES.value
        else []
    )

    event.title = payload.title
    event.description = payload.description
    event.type = CalendarEventType(payload.type)
    event.startsAt = to_utc(payload.startsAt)
    event.endsAt = to_utc(payload.endsAt)
    event.allDay = payload.allDay
    event.location = payload.location
    event.meetingLink = payload.meetingLink
    event.companyId = company_id
    event.jobProfileId = job_id
    event.visibility = CalendarVisibility(payload.visibility)
    event.targetBatches = payload.targetBatches if payload.visibility == "TARGETED" else []
    event.targetBranches = payload.targetBranches if payload.visibility == "TARGETED" else []
    event.updatedAt = datetime.now(timezone.utc)
    # Keep the rows that survive the edit rather than recreating them: a
    # fresh object with the same composite key as one being orphaned would
    # collide with it inside a single flush.
    kept_pocs = {p.userId: p for p in event.pocs}
    event.pocs = [kept_pocs.get(uid) or CalendarEventPoc(eventId=event.id, userId=uid) for uid in poc_ids]
    kept_attendees = {a.userId: a for a in event.attendees}
    event.attendees = [
        kept_attendees.get(uid) or CalendarEventAttendee(eventId=event.id, userId=uid)
        for uid in attendee_ids
    ]


async def _reload(db: AsyncSession, event_id: str) -> CalendarEvent:
    event = (
        await db.scalars(
            _loaded(select(CalendarEvent)).where(CalendarEvent.id == event_id).execution_options(
                populate_existing=True
            )
        )
    ).one()
    return event


@router.post("/events", response_model=CalendarEventSaveResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: CalendarEventWrite,
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_calendar_view(caller)
    check_write_rules(payload, caller)

    now = datetime.now(timezone.utc)
    event = CalendarEvent(
        id=str(uuid.uuid4()),
        createdById=caller["sub"],
        createdAt=now,
        updatedAt=now,
        pocs=[],
        attendees=[],
    )
    await _apply(db, event, payload)
    db.add(event)
    await db.flush()
    # Reloaded with its relationships before the clash check reads them: an
    # async session cannot lazy-load the company or POC names on access.
    warnings = await _conflict_warnings(db, await _reload(db, event.id))
    await db.commit()

    saved = await _reload(db, event.id)
    return CalendarEventSaveResponse(
        event=_to_response(saved, caller, staff_view=is_staff_viewer(caller)),
        warnings=warnings,
    )


async def _editable_event(db: AsyncSession, event_id: str, caller: dict) -> CalendarEvent:
    event = (await db.scalars(_loaded(select(CalendarEvent)).where(CalendarEvent.id == event_id))).first()
    staff_view = is_staff_viewer(caller)
    student = None if staff_view or event is None else await _student_context(db, caller)
    # Someone else's personal reminder, or a staff entry a student was not
    # shown, answers exactly like a missing one.
    if event is None or not _visible_to(event, caller, staff_view, student):
        raise HTTPException(status_code=404, detail="Calendar entry not found.")
    if not can_edit_event(caller, _enum_value(event.type), event.createdById):
        raise HTTPException(status_code=403, detail="You cannot change this calendar entry.")
    return event


@router.put("/events/{event_id}", response_model=CalendarEventSaveResponse)
async def update_event(
    event_id: str,
    payload: CalendarEventWrite,
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_calendar_view(caller)
    event = await _editable_event(db, event_id, caller)
    check_write_rules(payload, caller)
    # A reminder stays its author's: turning one into a shared entry would
    # hand a student's row to the placement cell, so the switch is refused in
    # both directions.
    was_personal = _enum_value(event.type) == CalendarEventType.PERSONAL.value
    if was_personal != (payload.type == CalendarEventType.PERSONAL.value):
        raise HTTPException(
            status_code=400,
            detail="A personal reminder cannot be turned into a shared entry, or the other way round.",
        )

    await _apply(db, event, payload)
    await db.flush()
    # Reloaded with its relationships before the clash check reads them: an
    # async session cannot lazy-load the company or POC names on access.
    warnings = await _conflict_warnings(db, await _reload(db, event.id))
    await db.commit()

    saved = await _reload(db, event.id)
    return CalendarEventSaveResponse(
        event=_to_response(saved, caller, staff_view=is_staff_viewer(caller)),
        warnings=warnings,
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_calendar_view(caller)
    event = await _editable_event(db, event_id, caller)
    await db.delete(event)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
