"""
Placement records.

An `Offer` is the outcome the placement office keeps on file: the FTE, PPO, or
internship a student actually received. Applications track a student through a
drive and stop at `SELECTED`; offers carry the money, the decision, and the
joining date, and exist even for offers that never had a drive in the portal.

Writes require `applications:manage`, the same permission that moves a
candidate through the pipeline; reads require `analytics:view` or that same
permission, because the placement dashboard is built from these rows.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    PERM_ANALYTICS_VIEW,
    PERM_APPLICATIONS_MANAGE,
    get_current_user,
    has_permission,
    require_permission,
)
from app.dependencies import get_db
from app.models.db import (
    Application,
    Company,
    JobProfile,
    Offer,
    OfferStatus,
    OfferType,
    Role,
    User,
)
from app.schemas.offer import (
    OfferCompanySummary,
    OfferCreate,
    OfferResponse,
    OfferStudentSummary,
    OfferUpdate,
)

router = APIRouter(prefix="/offers", tags=["offers"])

_CTC_TYPES = {OfferType.FTE, OfferType.PPO}


def require_offer_read(caller: dict = Depends(get_current_user)) -> dict:
    """Anyone who can read the dashboard, or manage applications, may read offers."""
    if has_permission(caller, PERM_ANALYTICS_VIEW) or has_permission(
        caller, PERM_APPLICATIONS_MANAGE
    ):
        return caller
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Permission '{PERM_ANALYTICS_VIEW}' is required for this resource.",
    )


def _parse_type(value: str) -> OfferType:
    try:
        return OfferType(value.strip().upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid offer type '{value}'. Allowed: {[t.value for t in OfferType]}",
        )


def _parse_status(value: str) -> OfferStatus:
    try:
        return OfferStatus(value.strip().upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid offer status '{value}'. Allowed: {[s.value for s in OfferStatus]}",
        )


def _to_response(offer: Offer) -> OfferResponse:
    student = None
    if offer.user:
        student = OfferStudentSummary(
            id=offer.user.id,
            name=offer.user.name,
            email=offer.user.email,
            rollNumber=offer.user.rollNumber,
            branch=offer.user.branch,
            degree=offer.user.degree,
            batch=offer.user.batch,
        )

    return OfferResponse(
        id=offer.id,
        userId=offer.userId,
        companyId=offer.companyId,
        jobProfileId=offer.jobProfileId,
        applicationId=offer.applicationId,
        jobTitle=offer.job_profile.title if offer.job_profile else None,
        type=offer.type.value if hasattr(offer.type, "value") else str(offer.type),
        status=offer.status.value if hasattr(offer.status, "value") else str(offer.status),
        batch=offer.batch,
        ctc=offer.ctc,
        stipend=offer.stipend,
        location=offer.location,
        offeredAt=offer.offeredAt,
        decidedAt=offer.decidedAt,
        joiningDate=offer.joiningDate,
        remarks=offer.remarks,
        createdAt=offer.createdAt,
        updatedAt=offer.updatedAt,
        student=student,
        company=OfferCompanySummary(id=offer.company.id, name=offer.company.name)
        if offer.company
        else None,
    )


def _loaded(stmt):
    return stmt.options(
        selectinload(Offer.user),
        selectinload(Offer.company),
        selectinload(Offer.job_profile),
    )


async def _require_amount_for_type(offer_type: OfferType, ctc: float | None, stipend: float | None):
    if offer_type in _CTC_TYPES and ctc is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An annual CTC is required for FTE and PPO offers.",
        )
    if offer_type == OfferType.INTERNSHIP and stipend is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A monthly stipend is required for internship offers.",
        )


@router.get("", response_model=list[OfferResponse])
async def list_offers(
    batch: Optional[int] = Query(None, description="Placement season (graduating batch year)"),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    company_id: Optional[str] = Query(None, alias="companyId"),
    search: Optional[str] = Query(None, description="Student name, roll number, email, or company"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    caller: dict = Depends(require_offer_read),
    db: AsyncSession = Depends(get_db),
):
    stmt = _loaded(select(Offer)).order_by(Offer.offeredAt.desc())

    if batch:
        stmt = stmt.where(Offer.batch == batch)
    if type_filter and type_filter != "ALL":
        stmt = stmt.where(Offer.type == _parse_type(type_filter))
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(Offer.status == _parse_status(status_filter))
    if company_id and company_id != "ALL":
        stmt = stmt.where(Offer.companyId == company_id)

    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        stmt = stmt.join(Offer.user).join(Offer.company).where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                User.rollNumber.ilike(pattern),
                Company.name.ilike(pattern),
            )
        )

    offers = (await db.scalars(stmt.offset(offset).limit(limit))).all()
    return [_to_response(offer) for offer in offers]


@router.get("/seasons", response_model=list[int])
async def list_seasons(
    caller: dict = Depends(require_offer_read),
    db: AsyncSession = Depends(get_db),
):
    """
    Seasons that have something to show: any batch with a recorded offer, plus
    any batch a job profile was opened for, so a season is selectable before
    its first offer is entered.
    """
    offer_batches = (await db.scalars(select(Offer.batch).distinct())).all()
    job_batches = (await db.scalars(select(JobProfile.batch).distinct())).all()
    return sorted({*offer_batches, *job_batches}, reverse=True)


@router.get("/options")
async def offer_form_options(
    caller: dict = Depends(require_offer_read),
    db: AsyncSession = Depends(get_db),
):
    """
    Everything the record-an-offer form needs to populate its selects, in one
    round trip: students, companies, and drives. The frontend has no direct
    database access, and a company list has no endpoint of its own yet.
    """
    students = (
        await db.scalars(
            select(User)
            .where(User.role == Role.STUDENT)
            .order_by(User.name.asc().nulls_last(), User.rollNumber.asc())
            .limit(2000)
        )
    ).all()
    companies = (await db.scalars(select(Company).order_by(Company.name.asc()))).all()
    jobs = (
        await db.scalars(
            select(JobProfile)
            .options(selectinload(JobProfile.company))
            .order_by(JobProfile.createdAt.desc())
            .limit(500)
        )
    ).all()

    return {
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "rollNumber": s.rollNumber,
                "branch": s.branch,
                "degree": s.degree,
                "batch": s.batch,
            }
            for s in students
        ],
        "companies": [{"id": c.id, "name": c.name} for c in companies],
        "jobs": [
            {
                "id": j.id,
                "title": j.title,
                "companyId": j.companyId,
                "companyName": j.company.name if j.company else None,
                "batch": j.batch,
                "type": j.type.value if hasattr(j.type, "value") else str(j.type),
            }
            for j in jobs
        ],
    }


@router.post("", response_model=OfferResponse, status_code=status.HTTP_201_CREATED)
async def create_offer(
    data: OfferCreate,
    caller: dict = Depends(require_permission(PERM_APPLICATIONS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    offer_type = _parse_type(data.type)
    offer_status = _parse_status(data.status)
    await _require_amount_for_type(offer_type, data.ctc, data.stipend)

    student = await db.scalar(select(User).where(User.id == data.userId))
    if not student:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student not found.")
    if student.role != Role.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offers can only be recorded against student accounts.",
        )

    company = await db.scalar(select(Company).where(Company.id == data.companyId))
    if not company:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found.")

    if data.jobProfileId:
        job = await db.scalar(select(JobProfile).where(JobProfile.id == data.jobProfileId))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Job profile not found."
            )

    if data.applicationId:
        application = await db.scalar(
            select(Application).where(Application.id == data.applicationId)
        )
        if not application:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Application not found."
            )
        existing = await db.scalar(
            select(Offer).where(Offer.applicationId == data.applicationId)
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This application already has a recorded offer.",
            )

    offer_id = f"cuid_{uuid.uuid4().hex[:20]}"
    offer = Offer(
        id=offer_id,
        userId=data.userId,
        companyId=data.companyId,
        jobProfileId=data.jobProfileId,
        applicationId=data.applicationId,
        type=offer_type,
        status=offer_status,
        batch=data.batch,
        ctc=data.ctc,
        stipend=data.stipend,
        location=(data.location or "").strip() or None,
        offeredAt=data.offeredAt or datetime.now(timezone.utc),
        decidedAt=(
            datetime.now(timezone.utc)
            if offer_status in (OfferStatus.ACCEPTED, OfferStatus.DECLINED)
            else None
        ),
        joiningDate=data.joiningDate,
        remarks=(data.remarks or "").strip() or None,
        createdById=caller.get("sub") or caller.get("id"),
    )
    db.add(offer)
    await db.commit()

    saved = await db.scalar(_loaded(select(Offer)).where(Offer.id == offer_id))
    return _to_response(saved)


@router.patch("/{offer_id}", response_model=OfferResponse)
async def update_offer(
    offer_id: str,
    data: OfferUpdate,
    caller: dict = Depends(require_permission(PERM_APPLICATIONS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    offer = await db.scalar(_loaded(select(Offer)).where(Offer.id == offer_id))
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")

    if data.type is not None:
        offer.type = _parse_type(data.type)
    if data.batch is not None:
        offer.batch = data.batch
    if "ctc" in data.model_fields_set:
        offer.ctc = data.ctc
    if "stipend" in data.model_fields_set:
        offer.stipend = data.stipend
    if "location" in data.model_fields_set:
        offer.location = (data.location or "").strip() or None
    if data.offeredAt is not None:
        offer.offeredAt = data.offeredAt
    if "joiningDate" in data.model_fields_set:
        offer.joiningDate = data.joiningDate
    if "remarks" in data.model_fields_set:
        offer.remarks = (data.remarks or "").strip() or None

    if data.companyId is not None:
        company = await db.scalar(select(Company).where(Company.id == data.companyId))
        if not company:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found.")
        offer.companyId = data.companyId

    if "jobProfileId" in data.model_fields_set:
        if data.jobProfileId:
            job = await db.scalar(select(JobProfile).where(JobProfile.id == data.jobProfileId))
            if not job:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Job profile not found."
                )
        offer.jobProfileId = data.jobProfileId

    if data.status is not None:
        new_status = _parse_status(data.status)
        if new_status in (OfferStatus.ACCEPTED, OfferStatus.DECLINED):
            offer.decidedAt = datetime.now(timezone.utc)
        elif new_status == OfferStatus.OFFERED:
            offer.decidedAt = None
        offer.status = new_status

    await _require_amount_for_type(offer.type, offer.ctc, offer.stipend)
    offer.updatedAt = datetime.now(timezone.utc)
    await db.commit()

    saved = await db.scalar(_loaded(select(Offer)).where(Offer.id == offer_id))
    return _to_response(saved)


@router.delete("/{offer_id}")
async def delete_offer(
    offer_id: str,
    caller: dict = Depends(require_permission(PERM_APPLICATIONS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    offer = await db.scalar(select(Offer).where(Offer.id == offer_id))
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")

    await db.delete(offer)
    await db.commit()
    return {"message": "Offer deleted successfully."}


@router.get("/me", response_model=list[OfferResponse])
async def my_offers(
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A student's own offers, so the portal can show them their record."""
    stmt = _loaded(select(Offer)).where(Offer.userId == caller.get("sub")).order_by(
        Offer.offeredAt.desc()
    )
    offers = (await db.scalars(stmt)).all()
    return [_to_response(offer) for offer in offers]
