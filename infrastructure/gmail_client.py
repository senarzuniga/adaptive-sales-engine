"""
Gmail client — email sending via SMTP/SSL.

Extracted from streamlit_app.py so the sending logic is independently
testable and reusable by any service.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def send_invite(
    recipient_email: str,
    recipient_name: str,
    temporary_password: str,
    app_url: str,
) -> None:
    """Send a welcome/invite email using the configured Gmail account.

    Raises ``ValueError`` when credentials are missing and ``Exception`` on
    SMTP failures so callers can handle errors appropriately.
    """
    from config import GMAIL_ADDRESS, GMAIL_APP_PASSWORD

    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_ADDRESS or GMAIL_APP_PASSWORD not configured in secrets.")

    safe_name = recipient_name or "Team Member"
    subject = "Welcome to Adaptive Sales Engine - INGECART Access"
    body = (
        f"Hello {safe_name},\n\n"
        "Welcome to Adaptive Sales Engine.\n"
        "We are pleased to invite you to join the application.\n\n"
        f"Access URL: {app_url}\n"
        f"Email: {recipient_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        "Please sign in and change your password on first access.\n\n"
        "Best regards,\nINGECART Team\n"
    )

    msg = EmailMessage()
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        smtp.send_message(msg)
    logger.info("Invite email sent to %s", recipient_email)


def send_welcome_email(email: str, name: str, password: str) -> bool:
    """Convenience wrapper used by the registration flow.  Returns True on success."""
    from config import STREAMLIT_APP_URL
    app_url = STREAMLIT_APP_URL or "https://your-app.streamlit.app"
    try:
        send_invite(email, name, password, app_url)
        return True
    except Exception as exc:
        logger.warning("Could not send welcome email to %s: %s", email, exc)
        return False
