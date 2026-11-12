"""ORM models (PRD section 10 / TRD section 5).

Quantities are integer kilograms and prices integer rupees per quintal.
Timestamps are ISO-8601 UTC strings and calendar dates are YYYY-MM-DD strings,
which sort correctly and behave the same on SQLite and PostgreSQL.
"""
from __future__ import annotations

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    role: Mapped[str] = mapped_column(String(10), index=True)
    phone: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(2), default="en")
    status: Mapped[str] = mapped_column(String(10), default="verified")
    created_at: Mapped[str] = mapped_column(String(30))


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    village: Mapped[str] = mapped_column(String(120))
    district_id: Mapped[str] = mapped_column(String(40))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    land_area_acres: Mapped[float] = mapped_column(Float)
    irrigation: Mapped[str] = mapped_column(String(12))
    soil_type: Mapped[str] = mapped_column(String(12))


class CompanyProfile(Base):
    __tablename__ = "company_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(16))
    gstin: Mapped[str] = mapped_column(String(15), unique=True)
    operating_districts: Mapped[list] = mapped_column(JSON, default=list)
    contact_person: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    district_id: Mapped[str] = mapped_column(String(40))
    submitted_at: Mapped[str] = mapped_column(String(30))
    verified_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(40), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Listing(Base):
    __tablename__ = "listings"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    farmer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    crop_id: Mapped[str] = mapped_column(String(20), index=True)
    variety: Mapped[str] = mapped_column(String(120), default="")
    qty_kg: Mapped[int] = mapped_column(Integer)
    qty_remaining_kg: Mapped[int] = mapped_column(Integer)
    ready_date: Mapped[str] = mapped_column(String(10))
    expected_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    district_id: Mapped[str] = mapped_column(String(40))
    village: Mapped[str] = mapped_column(String(120), default="")
    quality: Mapped[dict] = mapped_column(JSON, default=dict)
    photos: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String(30))


class Requirement(Base):
    __tablename__ = "requirements"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    crop_id: Mapped[str] = mapped_column(String(20), index=True)
    qty_kg: Mapped[int] = mapped_column(Integer)
    required_by: Mapped[str] = mapped_column(String(10))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    district_id: Mapped[str] = mapped_column(String(40))
    price_min: Mapped[int] = mapped_column(Integer)
    price_max: Mapped[int] = mapped_column(Integer)
    quality_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="open")
    created_at: Mapped[str] = mapped_column(String(30))


class Deal(Base):
    __tablename__ = "deals"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id"), index=True)
    requirement_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    farmer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    qty_kg: Mapped[int] = mapped_column(Integer)
    price_per_quintal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(12), index=True)
    last_offer_by: Mapped[str | None] = mapped_column(String(8), nullable=True)
    events: Mapped[list] = mapped_column(JSON, default=list)  # history[], camelCase event dicts
    created_at: Mapped[str] = mapped_column(String(30))
    updated_at: Mapped[str] = mapped_column(String(30))


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("deal_id", "reviewer_id"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id"), index=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(30))


class Flag(Base):
    __tablename__ = "flags"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id"))
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="open")
    created_at: Mapped[str] = mapped_column(String(30))


class AuditLog(Base):
    """Append-only: the application never updates or deletes rows here."""

    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    actor_id: Mapped[str] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[str] = mapped_column(String(40))
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    at: Mapped[str] = mapped_column(String(30), index=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    template: Mapped[str] = mapped_column(String(40))
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    link: Mapped[str | None] = mapped_column(String(200), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String(30))


class OtpChallenge(Base):
    __tablename__ = "otp_challenges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(16), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(30))
    expires_at: Mapped[str] = mapped_column(String(30))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[str] = mapped_column(String(30))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


# --- Data / ML ---------------------------------------------------------------


class MarketPrice(Base):
    __tablename__ = "market_prices"
    __table_args__ = (UniqueConstraint("crop_id", "mandi_id", "date"), Index("ix_mp_crop_mandi_date", "crop_id", "mandi_id", "date"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crop_id: Mapped[str] = mapped_column(String(20))
    mandi_id: Mapped[str] = mapped_column(String(40))
    date: Mapped[str] = mapped_column(String(10))
    min_price: Mapped[int] = mapped_column(Integer)
    max_price: Mapped[int] = mapped_column(Integer)
    modal_price: Mapped[int] = mapped_column(Integer)
    arrivals_t: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="synthetic")


class WeatherRecord(Base):
    __tablename__ = "weather_records"
    __table_args__ = (UniqueConstraint("district_id", "date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district_id: Mapped[str] = mapped_column(String(40), index=True)
    date: Mapped[str] = mapped_column(String(10))
    rain_mm: Mapped[float] = mapped_column(Float)
    tmax_c: Mapped[float] = mapped_column(Float)
    tmin_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_forecast: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(20), default="synthetic")


class SoilRecord(Base):
    __tablename__ = "soil_records"
    district_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    organic_carbon_g_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    clay_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    texture: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="reference")
    updated_at: Mapped[str] = mapped_column(String(30))


class Prediction(Base):
    """Latest ML signal per crop x district. Demand level is finalised at request
    time because it also depends on live platform demand."""

    __tablename__ = "predictions"
    __table_args__ = (UniqueConstraint("crop_id", "district_id", "as_of", "model_version"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crop_id: Mapped[str] = mapped_column(String(20), index=True)
    district_id: Mapped[str] = mapped_column(String(40), index=True)
    as_of: Mapped[str] = mapped_column(String(10))
    horizon_weeks: Mapped[int] = mapped_column(Integer)
    forecast_price_change_pct: Mapped[float] = mapped_column(Float)
    arrival_anomaly_pct: Mapped[float] = mapped_column(Float)
    historical_mape_pct: Mapped[float] = mapped_column(Float)
    fallback: Mapped[bool] = mapped_column(Boolean, default=False)
    demand_level: Mapped[str] = mapped_column(String(8))
    trend: Mapped[str] = mapped_column(String(8))
    price_direction: Mapped[str] = mapped_column(String(8))
    confidence: Mapped[float] = mapped_column(Float)
    drivers: Mapped[list] = mapped_column(JSON, default=list)  # extra explanation keys from SHAP
    model_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(30))


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(10), index=True)
    started_at: Mapped[str] = mapped_column(String(30))
    finished_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(10))
    records: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)


class ModelVersion(Base):
    __tablename__ = "model_versions"
    version: Mapped[str] = mapped_column(String(40), primary_key=True)
    trained_at: Mapped[str] = mapped_column(String(30))
    data_source: Mapped[str] = mapped_column(String(20))
    horizon_weeks: Mapped[int] = mapped_column(Integer)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
