"""Request bodies. Field names are camelCase on the wire to match the frontend types."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Body(BaseModel):
    model_config = ConfigDict(extra="ignore", str_max_length=8_000_000)


class LatLng(Body):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


Locale = Literal["en", "hi", "mr"]
Season = Literal["kharif", "rabi", "zaid"]
Irrigation = Literal["rainfed", "well", "borewell", "canal", "drip"]
SoilType = Literal["black", "red", "alluvial", "laterite", "unknown"]
Grade = Literal["A", "B", "C"]
Unit = Literal["q", "t"]
CompanyType = Literal["processor", "feed", "exporter", "retailer", "fpo", "trader", "institution"]


class OtpRequest(Body):
    phone: str = Field(max_length=20)


class OtpVerify(Body):
    phone: str = Field(max_length=20)
    code: str = Field(max_length=6)


class Onboarding(Body):
    registrationToken: str
    role: Literal["farmer", "company"]
    name: str = Field(max_length=200)
    language: Locale = "en"
    location: LatLng
    districtId: str
    consentAccount: bool = False
    consentMarketing: bool = False
    ageConfirmed: bool = False
    # farmer
    village: Optional[str] = None
    landAreaAcres: Optional[float] = None
    irrigation: Optional[Irrigation] = None
    soilType: Optional[SoilType] = None
    # company
    companyName: Optional[str] = None
    type: Optional[CompanyType] = None
    gstin: Optional[str] = None
    operatingDistricts: list[str] = []
    email: Optional[str] = Field(default=None, max_length=200)


class LanguageUpdate(Body):
    language: Locale


class FarmerUpdate(Body):
    name: Optional[str] = None
    village: Optional[str] = None
    districtId: Optional[str] = None
    location: Optional[LatLng] = None
    landAreaAcres: Optional[float] = None
    irrigation: Optional[Irrigation] = None
    soilType: Optional[SoilType] = None
    language: Optional[Locale] = None


class CompanyUpdate(Body):
    contactPerson: Optional[str] = None
    operatingDistricts: Optional[list[str]] = None
    email: Optional[str] = Field(default=None, max_length=200)
    location: Optional[LatLng] = None
    districtId: Optional[str] = None
    language: Optional[Locale] = None


class AdviceIn(Body):
    districtId: str
    landAreaAcres: float
    season: Season
    irrigation: Irrigation
    soilType: SoilType = "unknown"


class ListingQuality(Body):
    grade: Optional[Grade] = None
    moisturePct: Optional[float] = Field(default=None, ge=0, le=100)


class ListingIn(Body):
    cropId: str
    variety: str = Field(default="", max_length=500)
    quantity: float
    unit: Unit
    readyDate: str
    expectedPrice: Optional[int] = None
    location: LatLng
    districtId: str
    village: str = Field(default="", max_length=500)
    quality: ListingQuality = ListingQuality()
    photos: list[str] = []


class ListingPatch(Body):
    status: Literal["active", "paused"]


class QualitySpec(Body):
    minGrade: Optional[Grade] = None
    maxMoisturePct: Optional[float] = Field(default=None, ge=0, le=100)


class RequirementIn(Body):
    cropId: str
    quantity: float
    unit: Unit
    requiredBy: str
    deliveryLocation: LatLng
    districtId: str
    priceMin: int
    priceMax: int
    qualitySpec: QualitySpec = QualitySpec()
    notes: Optional[str] = None
    companyId: Optional[str] = None  # admin only: post on behalf of a verified company


class RequirementPatch(Body):
    status: Literal["open", "closed"]


class FlagIn(Body):
    reason: str


class DealIn(Body):
    listingId: str
    requirementId: Optional[str] = None
    qtyKg: int
    pricePerQuintal: Optional[int] = None
    note: Optional[str] = None


class DealAction(Body):
    action: Literal["send_offer", "counter", "accept", "reject", "cancel", "complete"]
    pricePerQuintal: Optional[int] = None
    note: Optional[str] = None


class ReviewIn(Body):
    rating: int
    comment: Optional[str] = None


class VerifyIn(Body):
    decision: Literal["approve", "reject"]
    reason: Optional[str] = None


class UserStatusIn(Body):
    status: Literal["verified", "blocked"]
    reason: Optional[str] = None


class FlagResolve(Body):
    action: Literal["dismiss", "hide", "block"]
