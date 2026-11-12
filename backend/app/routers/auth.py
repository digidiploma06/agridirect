"""OTP login, sessions and profiles (FR-01..03). Demo mode prints the OTP in
the server console and returns it to the login page; no SMS is sent."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response
from sqlalchemy import select

from ..catalogue import get_district
from ..config import settings
from ..deps import CurrentUser, Db, Company, Farmer, audit, new_id
from ..domain.dates import now_iso
from ..domain.validation import normalize_phone, sanitize_text, validate_gstin, validate_otp
from ..errors import ApiError
from ..models import CompanyProfile, FarmerProfile, User
from ..schemas import CompanyUpdate, FarmerUpdate, LanguageUpdate, Onboarding, OtpRequest, OtpVerify
from ..security import (
    check_otp,
    create_access_token,
    create_refresh_token,
    create_registration_token,
    issue_otp,
    read_registration_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from ..sms import send_otp
from ..views import company_view, farmer_view, session_view, user_view

router = APIRouter(tags=["auth"])
REFRESH_COOKIE = "agd_refresh"
COOKIE_PATH = "/api/v1/auth"


def _set_refresh(response: Response, raw: str) -> None:
    response.set_cookie(REFRESH_COOKIE, raw, max_age=settings.refresh_ttl_days * 86400, httponly=True, secure=settings.cookie_secure, samesite="strict", path=COOKIE_PATH)


def _login(db, response: Response, user: User) -> dict:
    _set_refresh(response, create_refresh_token(db, user.id))
    return {"accessToken": create_access_token(user.id), "session": session_view(db, user)}


@router.post("/auth/otp/request")
def request_otp(body: OtpRequest, db: Db):
    phone = normalize_phone(body.phone)
    if not phone:
        raise ApiError(422, "phone_invalid")
    code = issue_otp(db, phone)
    db.commit()
    send_otp(phone, code)
    out = {"phone": phone}
    if settings.otp_mode == "demo":
        out["devOtp"] = code  # never returned outside demo mode
    return out


@router.post("/auth/otp/verify")
def verify_otp(body: OtpVerify, db: Db, response: Response):
    phone = normalize_phone(body.phone)
    if not phone:
        raise ApiError(422, "phone_invalid")
    if validate_otp(body.code):
        raise ApiError(422, "otp_invalid")
    check_otp(db, phone, body.code)
    user = db.scalars(select(User).where(User.phone == phone)).first()
    if user is None:
        db.commit()
        return {"user": None, "registrationToken": create_registration_token(phone)}
    if user.status == "blocked":
        db.commit()
        raise ApiError(403, "blocked")
    out = _login(db, response, user)
    db.commit()
    return {"user": user_view(user), **out}


@router.post("/auth/register")
def register(body: Onboarding, db: Db, response: Response, request: Request):
    phone = read_registration_token(body.registrationToken)
    if not body.consentAccount or not body.ageConfirmed:
        raise ApiError(422, "consent_required")
    name = sanitize_text(body.name)
    if not name:
        raise ApiError(422, "name_required")
    if not get_district(body.districtId):
        raise ApiError(422, "district_required")
    if db.scalars(select(User).where(User.phone == phone)).first():
        raise ApiError(409, "phone_taken")
    now = now_iso()
    user = User(id=new_id("u"), role=body.role, phone=phone, name=name, language=body.language, status="pending" if body.role == "company" else "verified", created_at=now)
    db.add(user)
    db.flush()
    if body.role == "farmer":
        if not body.landAreaAcres or not (0 < body.landAreaAcres <= 10000):
            raise ApiError(422, "land_area_invalid")
        village = sanitize_text(body.village)
        if not village:
            raise ApiError(422, "village_required")
        db.add(FarmerProfile(user_id=user.id, village=village, district_id=body.districtId, lat=body.location.lat, lng=body.location.lng, land_area_acres=body.landAreaAcres, irrigation=body.irrigation or "rainfed", soil_type=body.soilType or "unknown"))
    else:
        gstin = (body.gstin or "").strip().upper()
        if err := validate_gstin(gstin):
            raise ApiError(422, err)
        if db.scalars(select(CompanyProfile).where(CompanyProfile.gstin == gstin)).first():
            raise ApiError(409, "gstin_taken")
        company_name = sanitize_text(body.companyName)
        if not company_name or not body.type:
            raise ApiError(422, "name_required")
        districts = [d for d in body.operatingDistricts if get_district(d)]
        db.add(CompanyProfile(user_id=user.id, company_name=company_name, type=body.type, gstin=gstin, operating_districts=districts, contact_person=name, email=(body.email or "").strip() or None, lat=body.location.lat, lng=body.location.lng, district_id=body.districtId, submitted_at=now))
    audit(db, user.id, "consent.given", "user", user.id, after={"notice": settings.privacy_notice_version, "account": True, "marketing": body.consentMarketing}, ip=request.client.host if request.client else None)
    out = _login(db, response, user)
    db.commit()
    return {"user": user_view(user), **out}


@router.post("/auth/refresh")
def refresh(db: Db, response: Response, agd_refresh: Annotated[str | None, Cookie()] = None):
    user_id, new_raw = rotate_refresh_token(db, agd_refresh or "")
    user = db.get(User, user_id)
    if user is None or user.status == "blocked":
        db.commit()
        raise ApiError(401, "unauthenticated")
    _set_refresh(response, new_raw)
    db.commit()
    return {"accessToken": create_access_token(user.id), "session": session_view(db, user)}


@router.post("/auth/logout", status_code=204)
def logout(db: Db, response: Response, agd_refresh: Annotated[str | None, Cookie()] = None):
    revoke_refresh_token(db, agd_refresh)
    db.commit()
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
    response.status_code = 204
    return response


@router.get("/auth/session")
def get_session(user: CurrentUser, db: Db):
    return session_view(db, user)


@router.put("/users/me/language", status_code=204)
def update_language(body: LanguageUpdate, user: CurrentUser, db: Db):
    user.language = body.language
    db.commit()


@router.get("/farmers/me")
def get_farmer(user: Farmer, db: Db):
    return session_view(db, user)


@router.put("/farmers/me")
def update_farmer(body: FarmerUpdate, user: Farmer, db: Db):
    f = db.get(FarmerProfile, user.id)
    if f is None:
        raise ApiError(404, "not_found")
    if body.name is not None:
        if not (name := sanitize_text(body.name)):
            raise ApiError(422, "name_required")
        user.name = name
    if body.village is not None:
        f.village = sanitize_text(body.village)
    if body.districtId is not None:
        if not get_district(body.districtId):
            raise ApiError(422, "district_required")
        f.district_id = body.districtId
    if body.location is not None:
        f.lat, f.lng = body.location.lat, body.location.lng
    if body.landAreaAcres is not None:
        if not (0 < body.landAreaAcres <= 10000):
            raise ApiError(422, "land_area_invalid")
        f.land_area_acres = body.landAreaAcres
    if body.irrigation is not None:
        f.irrigation = body.irrigation
    if body.soilType is not None:
        f.soil_type = body.soilType
    if body.language is not None:
        user.language = body.language
    db.commit()
    return {"user": user_view(user), "farmer": farmer_view(f)}


@router.get("/companies/me")
def get_company(user: Company, db: Db):
    return session_view(db, user)


@router.put("/companies/me")
def update_company(body: CompanyUpdate, user: Company, db: Db):
    """Name, type and GSTIN are what the admin verified, so they are not editable here."""
    c = db.get(CompanyProfile, user.id)
    if c is None:
        raise ApiError(404, "not_found")
    if body.contactPerson is not None:
        if not (name := sanitize_text(body.contactPerson)):
            raise ApiError(422, "name_required")
        c.contact_person = name
        user.name = name
    if body.operatingDistricts is not None:
        c.operating_districts = [d for d in body.operatingDistricts if get_district(d)]
    if body.email is not None:
        c.email = body.email.strip() or None
    if body.districtId is not None:
        if not get_district(body.districtId):
            raise ApiError(422, "district_required")
        c.district_id = body.districtId
    if body.location is not None:
        c.lat, c.lng = body.location.lat, body.location.lng
    if body.language is not None:
        user.language = body.language
    db.commit()
    return {"user": user_view(user), "company": company_view(c)}
