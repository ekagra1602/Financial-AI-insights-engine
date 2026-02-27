"""
Account Settings Router — email configuration and confirmation.
"""

import random
import string
from fastapi import APIRouter
from pydantic import BaseModel
from database import (
    get_user_settings,
    save_user_email,
    verify_confirmation_code,
    set_email_confirmed,
    toggle_email_notifications,
)
from services.email_service import send_confirmation_email

router = APIRouter(prefix="/api/v1/account", tags=["account"])


class EmailInput(BaseModel):
    email: str


class ConfirmInput(BaseModel):
    code: str


class ToggleInput(BaseModel):
    enabled: bool


def _generate_code() -> str:
    """Generate a 6-digit confirmation code."""
    return ''.join(random.choices(string.digits, k=6))


@router.get("/settings")
def get_settings():
    """Get current user settings."""
    return get_user_settings()


@router.post("/settings")
def save_settings(body: EmailInput):
    """Save email and send confirmation code."""
    code = _generate_code()
    save_user_email(body.email, code)
    send_confirmation_email(body.email, code)
    return {"message": "Confirmation email sent", "email": body.email}


@router.post("/confirm-email")
def confirm_email(body: ConfirmInput):
    """Confirm email with 6-digit code."""
    if verify_confirmation_code(body.code):
        set_email_confirmed()
        return {"confirmed": True, "message": "Email confirmed successfully"}
    else:
        return {"confirmed": False, "message": "Invalid confirmation code"}


@router.put("/email-notifications")
def update_email_notifications(body: ToggleInput):
    """Toggle email notifications on/off."""
    toggle_email_notifications(body.enabled)
    return {"email_notifications_enabled": body.enabled}
