from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

# FTE and PPO offers are paid as an annual CTC; internships as a monthly
# stipend. Keeping them in separate columns is what lets the dashboard average
# packages without mixing two different units.
_CTC_TYPES = {"FTE", "PPO"}


class OfferStudentSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    degree: Optional[str] = None
    batch: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class OfferCompanySummary(BaseModel):
    id: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class OfferBase(BaseModel):
    type: str
    status: str = "OFFERED"
    batch: int = Field(..., ge=2000, le=2100)
    ctc: Optional[float] = Field(None, ge=0)
    stipend: Optional[float] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=200)
    offeredAt: Optional[datetime] = None
    joiningDate: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=2000)


class OfferCreate(OfferBase):
    userId: str
    companyId: str
    jobProfileId: Optional[str] = None
    applicationId: Optional[str] = None

    @model_validator(mode="after")
    def validate_amount(self) -> "OfferCreate":
        offer_type = (self.type or "").strip().upper()
        if offer_type in _CTC_TYPES and self.ctc is None:
            raise ValueError("An annual CTC is required for FTE and PPO offers.")
        if offer_type == "INTERNSHIP" and self.stipend is None:
            raise ValueError("A monthly stipend is required for internship offers.")
        return self


class OfferUpdate(BaseModel):
    type: Optional[str] = None
    status: Optional[str] = None
    batch: Optional[int] = Field(None, ge=2000, le=2100)
    ctc: Optional[float] = Field(None, ge=0)
    stipend: Optional[float] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=200)
    offeredAt: Optional[datetime] = None
    joiningDate: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=2000)
    companyId: Optional[str] = None
    jobProfileId: Optional[str] = None


class OfferResponse(OfferBase):
    id: str
    userId: str
    companyId: str
    jobProfileId: Optional[str] = None
    applicationId: Optional[str] = None
    jobTitle: Optional[str] = None
    decidedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    student: Optional[OfferStudentSummary] = None
    company: Optional[OfferCompanySummary] = None

    model_config = ConfigDict(from_attributes=True)
