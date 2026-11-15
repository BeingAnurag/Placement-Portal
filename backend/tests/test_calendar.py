"""
Tests for the placement calendar.

Most of the behaviour worth pinning is who sees what and who may write what,
and both live in pure functions (services/calendar.py, plus the router's
check_write_rules / can_edit_event / is_staff_viewer), tested here directly.
The endpoint tests use the same "capture the statement off db.scalars"
approach as test_applications_admin_list.py, to check the permission gates
and that a student's query never asks for staff-only rows.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.core.security import (
    PERM_CALENDAR_MANAGE,
    PERM_CALENDAR_VIEW,
    ROLE_DEFAULT_PERMISSIONS,
    STUDENT_SCOPED_PERMISSIONS,
    get_current_user,
)
from app.dependencies import get_db
from app.routers.calendar import _to_response, can_edit_event, check_write_rules, is_staff_viewer
from app.schemas.calendar import CalendarEventWrite
from app.services.calendar import EventSlot, StudentContext, find_conflicts, ranges_overlap, student_can_see, to_utc

IST = timezone(timedelta(hours=5, minutes=30))

STUDENT = {"sub": "stu_1", "email": "lit2027001@iiitl.ac.in", "role": "STUDENT"}
OTHER_STUDENT = {"sub": "stu_2", "email": "lit2027002@iiitl.ac.in", "role": "STUDENT"}
TEAM = {"sub": "usr_team", "email": "team@iiitl.ac.in", "role": "PLACEMENT_TEAM"}
VOLUNTEER = {"sub": "usr_vol", "email": "vol@iiitl.ac.in", "role": "PLACEMENT_VOLUNTEER"}
FACULTY = {"sub": "usr_fac", "email": "fac@iiitl.ac.in", "role": "FACULTY"}


def _t(hour: int, minute: int = 0, day: int = 20) -> datetime:
    return datetime(2026, 11, day, hour, minute, tzinfo=IST)


def _payload(**overrides) -> CalendarEventWrite:
    data = {
        "title": "Acme campus visit",
        "type": "COMPANY_VISIT",
        "startsAt": _t(10).isoformat(),
        "endsAt": _t(12).isoformat(),
        "visibility": "STAFF",
    }
    data.update(overrides)
    return CalendarEventWrite.model_validate(data)


# ---------------------------------------------------------------------------
# Permissions catalog
# ---------------------------------------------------------------------------

def test_role_defaults_for_calendar():
    assert PERM_CALENDAR_VIEW in STUDENT_SCOPED_PERMISSIONS
    assert PERM_CALENDAR_MANAGE not in STUDENT_SCOPED_PERMISSIONS
    for role in ("PLACEMENT_TEAM", "PLACEMENT_VOLUNTEER", "SUPER_ADMIN"):
        assert PERM_CALENDAR_MANAGE in ROLE_DEFAULT_PERMISSIONS[role]
    assert PERM_CALENDAR_VIEW in ROLE_DEFAULT_PERMISSIONS["FACULTY"]
    assert PERM_CALENDAR_MANAGE not in ROLE_DEFAULT_PERMISSIONS["FACULTY"]


def test_staff_viewer_excludes_students_even_though_they_hold_view():
    assert not is_staff_viewer(STUDENT)
    assert is_staff_viewer(TEAM)
    assert is_staff_viewer(VOLUNTEER)
    assert is_staff_viewer(FACULTY)
    revoked = {**TEAM, "customPermissions": ["-calendar.view"]}
    assert not is_staff_viewer(revoked)


# ---------------------------------------------------------------------------
# Time handling
# ---------------------------------------------------------------------------

def test_to_utc_treats_naive_as_utc_and_converts_aware():
    naive = datetime(2026, 11, 20, 4, 30)
    assert to_utc(naive) == datetime(2026, 11, 20, 4, 30, tzinfo=timezone.utc)
    assert to_utc(_t(10)) == datetime(2026, 11, 20, 4, 30, tzinfo=timezone.utc)


def test_overlap_is_half_open():
    assert ranges_overlap(_t(10), _t(11), _t(10, 30), _t(12))
    assert not ranges_overlap(_t(10), _t(11), _t(11), _t(12))
    # Mixed naive (UTC) and aware values compare correctly.
    assert ranges_overlap(datetime(2026, 11, 20, 4, 45), datetime(2026, 11, 20, 5, 0), _t(10), _t(11))


# ---------------------------------------------------------------------------
# Who sees what
# ---------------------------------------------------------------------------

def _see(visibility, student=StudentContext("stu_1", 2027, "CS"), **kw):
    return student_can_see(
        visibility=visibility,
        created_by_id=kw.get("created_by_id", "usr_team"),
        target_batches=kw.get("batches", []),
        target_branches=kw.get("branches", []),
        attendee_ids=kw.get("attendees", set()),
        student=student,
    )


def test_staff_events_are_never_visible_to_students():
    assert not _see("STAFF")


def test_shared_events_are_visible_to_every_student():
    assert _see("STUDENTS")
    assert _see("STUDENTS", StudentContext("stu_x", None, None))


def test_targeted_matches_batch_and_branch():
    assert _see("TARGETED", batches=[2027])
    assert not _see("TARGETED", batches=[2028])
    assert _see("TARGETED", branches=["cse"])  # case-insensitive
    assert not _see("TARGETED", branches=["IT"])
    assert _see("TARGETED", batches=[2027], branches=["CS", "IT"])
    assert not _see("TARGETED", batches=[2027], branches=["IT"])


def test_targeted_excludes_students_with_no_batch_on_record():
    assert not _see("TARGETED", StudentContext("stu_1", None, "CS"), batches=[2027])


def test_attendee_events_need_the_student_listed():
    assert _see("ATTENDEES", attendees={"stu_1", "stu_9"})
    assert not _see("ATTENDEES", attendees={"stu_9"})
    assert not _see("ATTENDEES", attendees=set())


def test_private_events_are_only_for_their_author():
    assert _see("PRIVATE", created_by_id="stu_1")
    assert not _see("PRIVATE", created_by_id="stu_2")


# ---------------------------------------------------------------------------
# Clash warnings
# ---------------------------------------------------------------------------

def test_same_company_overlap_with_a_different_poc_warns():
    mine = EventSlot(None, "Acme PPT", _t(10), _t(11), "co_acme", "Acme", {"u_a": "Asha"})
    theirs = EventSlot("ev_2", "Acme test", _t(10, 30), _t(12), "co_acme", "Acme", {"u_b": "Bharat"})
    warnings = find_conflicts(mine, [theirs])
    assert warnings == ['Acme already has "Acme test" at an overlapping time (Bharat).']


def test_same_company_same_poc_does_not_warn_about_the_company():
    mine = EventSlot(None, "Acme PPT", _t(10), _t(11), "co_acme", "Acme", {"u_a": "Asha"})
    theirs = EventSlot("ev_2", "Acme test", _t(10, 30), _t(12), "co_acme", "Acme", {"u_a": "Asha"})
    # Only the double-booking warning, not the "someone else owns this" one.
    assert find_conflicts(mine, [theirs]) == ['Asha is already POC for "Acme test" at an overlapping time.']


def test_poc_double_booking_warns_across_companies():
    mine = EventSlot(None, "Acme PPT", _t(10), _t(11), "co_acme", "Acme", {"u_a": "Asha"})
    theirs = EventSlot("ev_2", "Globex visit", _t(10), _t(11), "co_globex", "Globex", {"u_a": "Asha"})
    assert find_conflicts(mine, [theirs]) == ['Asha is already POC for "Globex visit" at an overlapping time.']


def test_no_warning_without_overlap_or_for_the_event_itself():
    mine = EventSlot("ev_1", "Acme PPT", _t(10), _t(11), "co_acme", "Acme", {"u_a": "Asha"})
    later = EventSlot("ev_2", "Acme test", _t(11), _t(12), "co_acme", "Acme", {"u_b": "Bharat"})
    itself = EventSlot("ev_1", "Acme PPT", _t(10), _t(11), "co_acme", "Acme", {"u_b": "Bharat"})
    assert find_conflicts(mine, [later, itself]) == []


# ---------------------------------------------------------------------------
# Write rules
# ---------------------------------------------------------------------------

def test_staff_can_create_shared_entries():
    check_write_rules(_payload(), TEAM)
    check_write_rules(_payload(visibility="STUDENTS"), VOLUNTEER)


def test_students_cannot_create_shared_entries():
    with pytest.raises(HTTPException) as exc:
        check_write_rules(_payload(visibility="STUDENTS"), STUDENT)
    assert exc.value.status_code == 403


def test_faculty_cannot_create_shared_entries():
    with pytest.raises(HTTPException) as exc:
        check_write_rules(_payload(), FACULTY)
    assert exc.value.status_code == 403


def test_students_can_create_personal_reminders():
    check_write_rules(_payload(type="PERSONAL", visibility="PRIVATE"), STUDENT)


@pytest.mark.parametrize(
    "type_, visibility",
    [("PERSONAL", "STUDENTS"), ("INTERVIEW", "PRIVATE")],
)
def test_personal_and_private_go_together(type_, visibility):
    with pytest.raises(HTTPException) as exc:
        check_write_rules(_payload(type=type_, visibility=visibility), TEAM)
    assert exc.value.status_code == 400


def test_end_before_start_is_refused():
    with pytest.raises(HTTPException) as exc:
        check_write_rules(_payload(startsAt=_t(12).isoformat(), endsAt=_t(10).isoformat()), TEAM)
    assert exc.value.status_code == 400


def test_overlong_entries_are_refused():
    with pytest.raises(HTTPException):
        check_write_rules(_payload(endsAt=(_t(10) + timedelta(days=15)).isoformat()), TEAM)


def test_targeted_needs_a_batch_or_branch():
    with pytest.raises(HTTPException):
        check_write_rules(_payload(visibility="TARGETED"), TEAM)
    check_write_rules(_payload(visibility="TARGETED", targetBatches=[2027]), TEAM)


def test_attendees_visibility_needs_attendees():
    with pytest.raises(HTTPException):
        check_write_rules(_payload(type="INTERVIEW", visibility="ATTENDEES"), TEAM)
    check_write_rules(_payload(type="INTERVIEW", visibility="ATTENDEES", attendeeIds=["stu_1"]), TEAM)
    check_write_rules(
        _payload(
            type="INTERVIEW",
            visibility="ATTENDEES",
            attendeesFromJob={"jobProfileId": "job_1", "statuses": ["INTERVIEW"]},
        ),
        TEAM,
    )


def test_schema_cleans_input():
    payload = _payload(
        title="  Acme  ",
        location="   ",
        targetBranches=[" CS", "CSE", "cse", ""],
        targetBatches=[2028, 2027, 2027],
        pocIds=["u_a", "u_a", " u_b "],
    )
    assert payload.title == "Acme"
    assert payload.location is None
    assert payload.targetBranches == ["CS"]
    assert payload.targetBatches == [2027, 2028]
    assert payload.pocIds == ["u_a", "u_b"]


def test_schema_rejects_non_http_meeting_links():
    with pytest.raises(ValueError):
        _payload(meetingLink="javascript:alert(1)")
    assert _payload(meetingLink="https://meet.google.com/abc").meetingLink == "https://meet.google.com/abc"


def test_edit_rights():
    assert can_edit_event(TEAM, "COMPANY_VISIT", "usr_other")
    assert can_edit_event(VOLUNTEER, "INTERVIEW", "usr_other")
    assert not can_edit_event(FACULTY, "COMPANY_VISIT", "usr_other")
    assert not can_edit_event(STUDENT, "COMPANY_VISIT", "usr_team")
    assert can_edit_event(STUDENT, "PERSONAL", "stu_1")
    assert not can_edit_event(OTHER_STUDENT, "PERSONAL", "stu_1")
    # Staff cannot edit a student's reminder either.
    assert not can_edit_event(TEAM, "PERSONAL", "stu_1")


# ---------------------------------------------------------------------------
# Response shaping
# ---------------------------------------------------------------------------

def _event(**overrides):
    poc_user = SimpleNamespace(id="u_a", name="Asha", email="asha@iiitl.ac.in", rollNumber=None, branch=None, batch=None)
    stu_user = SimpleNamespace(id="stu_1", name="S One", email="s1@iiitl.ac.in", rollNumber="LIT1", branch="CS", batch=2027)
    data = dict(
        id="ev_1",
        title="Acme interview",
        description=None,
        type="INTERVIEW",
        startsAt=datetime(2026, 11, 20, 4, 30),  # naive, as read back from Postgres
        endsAt=datetime(2026, 11, 20, 5, 30),
        allDay=False,
        location=None,
        meetingLink="https://meet.google.com/abc",
        companyId="co_acme",
        company=SimpleNamespace(name="Acme"),
        jobProfileId=None,
        job_profile=None,
        visibility="ATTENDEES",
        targetBatches=[],
        targetBranches=[],
        createdById="usr_team",
        created_by=SimpleNamespace(name="Team"),
        pocs=[SimpleNamespace(userId="u_a", user=poc_user)],
        attendees=[SimpleNamespace(userId="stu_1", user=stu_user)],
        createdAt=datetime(2026, 11, 1),
        updatedAt=datetime(2026, 11, 1),
    )
    data.update(overrides)
    return SimpleNamespace(**data)


def test_student_response_hides_attendees_and_marks_their_own_slot():
    res = _to_response(_event(), STUDENT, staff_view=False)
    assert res.attendees is None
    assert res.attendeeCount == 0
    assert res.isAttendee is True
    assert res.createdByName is None
    assert res.canEdit is False
    assert res.pocs[0].name == "Asha"
    assert res.startsAt.tzinfo is not None
    assert res.startsAt == datetime(2026, 11, 20, 4, 30, tzinfo=timezone.utc)


def test_staff_response_lists_attendees():
    res = _to_response(_event(), TEAM, staff_view=True)
    assert [a.id for a in res.attendees] == ["stu_1"]
    assert res.attendeeCount == 1
    assert res.canEdit is True
    assert res.createdByName == "Team"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    from main import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
        test_client.app.dependency_overrides.clear()


def _as(client, caller):
    client.app.dependency_overrides[get_current_user] = lambda: caller


def _install_capturing_db(client):
    captured: dict = {"stmts": []}

    async def _fake_db():
        db = AsyncMock()

        async def _scalars(stmt):
            captured["stmts"].append(stmt)
            result = MagicMock()
            result.all.return_value = []
            result.first.return_value = None
            return result

        db.scalars = _scalars
        db.get = AsyncMock(return_value=SimpleNamespace(id="stu_1", batch=2027, branch="CS"))
        yield db

    client.app.dependency_overrides[get_db] = _fake_db
    return captured


def _compiled(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


RANGE = {"from": "2026-11-01T00:00:00+05:30", "to": "2026-12-01T00:00:00+05:30"}


def test_student_list_query_never_requests_staff_rows(client):
    _as(client, STUDENT)
    captured = _install_capturing_db(client)
    response = client.get("/api/v1/calendar/events", params=RANGE)
    assert response.status_code == 200
    sql = _compiled(captured["stmts"][0])
    assert "'STUDENTS'" in sql and "'TARGETED'" in sql and "'ATTENDEES'" in sql
    assert "'STAFF'" not in sql
    assert "'stu_1'" in sql


def test_staff_list_query_excludes_other_peoples_private_rows(client):
    _as(client, TEAM)
    captured = _install_capturing_db(client)
    response = client.get("/api/v1/calendar/events", params={**RANGE, "pocId": "usr_team"})
    assert response.status_code == 200
    sql = _compiled(captured["stmts"][0])
    assert "!= 'PRIVATE'" in sql
    assert '"CalendarEventPoc"' in sql


def test_list_requires_a_bounded_range(client):
    _as(client, TEAM)
    _install_capturing_db(client)
    assert client.get("/api/v1/calendar/events").status_code == 422
    too_wide = {"from": "2026-01-01T00:00:00Z", "to": "2026-12-01T00:00:00Z"}
    assert client.get("/api/v1/calendar/events", params=too_wide).status_code == 400
    backwards = {"from": RANGE["to"], "to": RANGE["from"]}
    assert client.get("/api/v1/calendar/events", params=backwards).status_code == 400


def test_list_rejects_unknown_type(client):
    _as(client, TEAM)
    _install_capturing_db(client)
    assert client.get("/api/v1/calendar/events", params={**RANGE, "type": "PARTY"}).status_code == 400


def test_revoked_view_permission_is_refused(client):
    _as(client, {**STUDENT, "customPermissions": ["-calendar.view"]})
    _install_capturing_db(client)
    assert client.get("/api/v1/calendar/events", params=RANGE).status_code == 403


def test_options_are_staff_only(client):
    _as(client, STUDENT)
    _install_capturing_db(client)
    assert client.get("/api/v1/calendar/options").status_code == 403
    _as(client, FACULTY)
    assert client.get("/api/v1/calendar/options").status_code == 403


def test_student_cannot_post_a_shared_entry(client):
    _as(client, STUDENT)
    _install_capturing_db(client)
    body = {
        "title": "Fake drive",
        "type": "COMPANY_VISIT",
        "startsAt": "2026-11-20T10:00:00+05:30",
        "endsAt": "2026-11-20T11:00:00+05:30",
        "visibility": "STUDENTS",
    }
    assert client.post("/api/v1/calendar/events", json=body).status_code == 403


def test_editing_a_missing_or_hidden_entry_is_404(client):
    _as(client, STUDENT)
    _install_capturing_db(client)
    body = {
        "title": "Reminder",
        "type": "PERSONAL",
        "startsAt": "2026-11-20T10:00:00+05:30",
        "endsAt": "2026-11-20T11:00:00+05:30",
        "visibility": "PRIVATE",
    }
    assert client.put("/api/v1/calendar/events/ev_x", json=body).status_code == 404
    assert client.delete("/api/v1/calendar/events/ev_x").status_code == 404


# ---------------------------------------------------------------------------
# Adding a company from the calendar
# ---------------------------------------------------------------------------

def test_schema_blank_company_name_is_none():
    assert _payload(companyName="   ").companyName is None
    assert _payload(companyName=" Demandbase ").companyName == "Demandbase"


def test_company_name_query_matches_case_insensitively():
    import asyncio

    from app.routers.calendar import _company_by_name

    captured: dict = {}
    existing = SimpleNamespace(id="co_amazon")

    async def run():
        db = AsyncMock()

        async def _scalars(stmt):
            captured["sql"] = _compiled(stmt)
            result = MagicMock()
            result.first.return_value = existing
            return result

        db.scalars = _scalars
        company_id = await _company_by_name(db, "  amazon   web  services ")
        db.add.assert_not_called()
        return company_id

    assert asyncio.run(run()) == "co_amazon"
    assert "lower" in captured["sql"].lower()
    assert "'amazon web services'" in captured["sql"]


def test_company_name_creates_a_minimal_company_when_missing():
    import asyncio

    from app.models.db import Company
    from app.routers.calendar import _company_by_name

    async def run():
        db = AsyncMock()
        db.add = MagicMock()

        async def _scalars(stmt):
            result = MagicMock()
            result.first.return_value = None
            return result

        db.scalars = _scalars
        company_id = await _company_by_name(db, "Demandbase")
        added = db.add.call_args.args[0]
        return company_id, added

    company_id, added = asyncio.run(run())
    assert isinstance(added, Company)
    assert added.name == "Demandbase"
    assert added.id == company_id


def test_personal_reminder_cannot_add_a_company(client):
    _as(client, STUDENT)
    _install_capturing_db(client)
    body = {
        "title": "Prep",
        "type": "PERSONAL",
        "visibility": "PRIVATE",
        "startsAt": "2026-11-20T10:00:00+05:30",
        "endsAt": "2026-11-20T11:00:00+05:30",
        "companyName": "Totally New Co",
    }
    response = client.post("/api/v1/calendar/events", json=body)
    assert response.status_code == 400
    assert "company" in response.json()["detail"].lower()
