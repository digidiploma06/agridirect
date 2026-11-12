"""Outbound messages. In demo mode nothing leaves the machine: the OTP is
printed here and also returned to the login page. For production, implement
`_send_sms` with your provider (MSG91, Twilio, ...) and set OTP_MODE=sms."""
from __future__ import annotations

import logging

from .config import settings

log = logging.getLogger("agridirect.sms")


def _send_sms(phone: str, text: str) -> None:  # pragma: no cover - provider hook
    raise NotImplementedError("No SMS provider configured. Implement app/sms.py:_send_sms and set OTP_MODE=sms.")


def send_otp(phone: str, code: str) -> None:
    if settings.otp_mode == "demo":
        print(f"\n  [DEMO OTP]  {phone}  ->  {code}   (valid {settings.otp_ttl_min} min)\n", flush=True)
        return
    _send_sms(phone, f"{code} is your AgriDirect login code. Valid for {settings.otp_ttl_min} minutes. Do not share it.")


def send_notification(phone: str, template: str, params: dict) -> None:
    """Hook for SMS / WhatsApp alerts (FR-13). In-app notifications are always
    stored; external delivery only happens once a provider is configured."""
    if settings.otp_mode == "demo":
        log.info("notification (not sent, demo mode) to %s: %s %s", phone, template, params)
        return
    try:  # pragma: no cover - provider hook
        _send_sms(phone, f"AgriDirect: {template.replace('_', ' ')}")
    except Exception as e:  # never fail a request because an alert failed
        log.warning("notification delivery failed: %s", e)
