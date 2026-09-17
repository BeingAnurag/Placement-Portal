from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class AnnouncementCompanySummary(BaseModel):
    id: str
    name: str
    logoUrl: Optional[str] = None
    website: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AnnouncementAuthorSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AnnouncementAttachmentInput(BaseModel):
    """One already-uploaded file, as returned by the upload endpoint."""
    fileName: str = Field(..., min_length=1, max_length=255)
    fileUrl: str = Field(..., min_length=1, max_length=1000)
    mimeType: str = Field(..., min_length=1, max_length=120)
    sizeBytes: int = Field(..., ge=0)

class AnnouncementAttachmentResponse(AnnouncementAttachmentInput):
    id: str
    uploadedAt: datetime

    model_config = ConfigDict(from_attributes=True)

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=2, max_length=10000)
    category: str = Field(default="GENERAL")
    tags: list[str] = Field(default_factory=list)
    companyId: Optional[str] = None
    # The drive the announcement is about, when it is about one.
    jobProfileId: Optional[str] = None

class AnnouncementCreate(AnnouncementBase):
    attachments: list[AnnouncementAttachmentInput] = Field(default_factory=list, max_length=10)
    # Saving a draft is the deliberate act; an omitted status publishes, which
    # keeps every existing caller behaving as it did.
    status: str = Field(default="PUBLISHED")

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    content: Optional[str] = Field(None, min_length=2, max_length=10000)
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    companyId: Optional[str] = None
    jobProfileId: Optional[str] = None
    status: Optional[str] = None
    # Sent whole or not at all: an omitted list leaves the files alone, and a
    # list replaces them, which is what the composer's remove control means.
    attachments: Optional[list[AnnouncementAttachmentInput]] = Field(None, max_length=10)

class AnnouncementResponse(AnnouncementBase):
    id: str
    status: str
    jobTitle: Optional[str] = None
    publishedAt: Optional[datetime] = None
    createdAt: datetime
    createdById: str
    company: Optional[AnnouncementCompanySummary] = None
    createdByName: Optional[str] = None
    createdByEmail: Optional[str] = None
    attachments: list[AnnouncementAttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

