from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.services.branch import canonical_branch_list

CalendarEventTypeLiteral = Literal[
    "COMPANY_VISIT", "PRE_PLACEMENT_TALK", "TEST", "INTERVIEW", "DEADLINE", "OTHER", "PERSONAL"
]
CalendarVisibilityLiteral = Literal["STAFF", "STUDENTS", "TARGETED", "ATTENDEES", "PRIVATE"]
ApplicationStatusLiteral = Literal[
    "APPLIED",
    "SHORTLISTED",
    "INTERVIEW",
    "SELECTED",
    "REJECTED",
    "OFFER_ACCEPTED",
    "OFFER_DECLINED",
    "WITHDRAWN",
]


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


class AttendeesFromJob(BaseModel):
    """Add every applicant of a drive in the given stages as attendees."""

    jobProfileId: str = Field(..., min_length=1)
    statuses: list[ApplicationStatusLiteral] = Field(..., min_length=1)


class CalendarEventWrite(BaseModel):
    """
    The full state of an event, sent on both create and update.

    Update replaces the event wholesale rather than merging, because the one
    form that writes it always has every field in hand, and replace semantics
    make "remove the last POC" expressible.
    """

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=4000)
    type: CalendarEventTypeLiteral = "OTHER"
    startsAt: datetime
    endsAt: datetime
    allDay: bool = False
    location: Optional[str] = Field(None, max_length=300)
    meetingLink: Optional[str] = Field(None, max_length=1000)
    companyId: Optional[str] = None
    # A recruiter with no Company row yet, typed or picked from the curated
    # list. Only read when companyId is empty; the save finds a company with
    # this name (ignoring case) or creates one.
    companyName: Optional[str] = Field(None, max_length=200)
    jobProfileId: Optional[str] = None
    visibility: CalendarVisibilityLiteral = "STAFF"
    targetBatches: list[int] = Field(default_factory=list, max_length=20)
    targetBranches: list[str] = Field(default_factory=list, max_length=50)
    pocIds: list[str] = Field(default_factory=list, max_length=10)
    attendeeIds: list[str] = Field(default_factory=list, max_length=2000)
    attendeesFromJob: Optional[AttendeesFromJob] = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator(
        "description", "location", "meetingLink", "companyId", "companyName", "jobProfileId", mode="before"
    )
    @classmethod
    def blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        return _blank_to_none(v) if isinstance(v, str) or v is None else v

    @field_validator("meetingLink")
    @classmethod
    def http_link(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.lower().startswith(("http://", "https://")):
            raise ValueError("Meeting link must start with http:// or https://.")
        return v

    @field_validator("targetBatches")
    @classmethod
    def sane_batches(cls, v: list[int]) -> list[int]:
        for batch in v:
            if batch < 2000 or batch > 2100:
                raise ValueError("Batch years must be between 2000 and 2100.")
        return sorted(set(v))

    @field_validator("targetBranches")
    @classmethod
    def clean_branches(cls, v: list[str]) -> list[str]:
        return sorted(canonical_branch_list(v))

    @field_validator("pocIds", "attendeeIds")
    @classmethod
    def dedupe_ids(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(i.strip() for i in v if i and i.strip()))


class CalendarPerson(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[int] = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    type: CalendarEventTypeLiteral
    startsAt: datetime
    endsAt: datetime
    allDay: bool
    location: Optional[str] = None
    meetingLink: Optional[str] = None
    companyId: Optional[str] = None
    companyName: Optional[str] = None
    jobProfileId: Optional[str] = None
    jobTitle: Optional[str] = None
    visibility: CalendarVisibilityLiteral
    targetBatches: list[int] = Field(default_factory=list)
    targetBranches: list[str] = Field(default_factory=list)
    createdById: str
    createdByName: Optional[str] = None
    pocs: list[CalendarPerson] = Field(default_factory=list)
    # Staff only. A student is told whether they are on the list, never who
    # else is.
    attendees: Optional[list[CalendarPerson]] = None
    attendeeCount: int = 0
    isAttendee: bool = False
    canEdit: bool = False
    createdAt: datetime
    updatedAt: datetime


class CalendarEventSaveResponse(BaseModel):
    event: CalendarEventResponse
    warnings: list[str] = Field(default_factory=list)


class CalendarCompanyOption(BaseModel):
    id: str
    name: str


class CalendarJobOption(BaseModel):
    id: str
    title: str
    companyId: str
    companyName: Optional[str] = None
    status: str


class CalendarOptionsResponse(BaseModel):
    staff: list[CalendarPerson]
    students: list[CalendarPerson]
    companies: list[CalendarCompanyOption]
    jobs: list[CalendarJobOption]
    batches: list[int]
    branches: list[str]
