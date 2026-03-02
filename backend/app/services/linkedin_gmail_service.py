"""LinkedIn connection acceptance detection via Gmail + notification service."""

import asyncio
import base64
import logging
import re
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.linkedin_connection import LinkedInConnection
from app.services import linkedin_connection_service, push_service
from app.services.google_calendar_service import get_credentials

logger = logging.getLogger(__name__)


def _build_gmail_service(credentials):
    """Build a Gmail API service."""
    from googleapiclient.discovery import build

    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def _extract_name_from_subject(subject: str) -> Optional[str]:
    """Extract person name from LinkedIn acceptance email subject.

    LinkedIn subjects are typically:
    - "John Doe accepted your invitation"
    - "John Doe accepted your invitation to connect"
    """
    match = re.match(r"^(.+?)\s+accepted your invitation", subject, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _normalize(name: str) -> str:
    """Normalize a name for fuzzy matching."""
    return re.sub(r"\s+", " ", name.strip().lower())


def _names_match(email_name: str, stored_name: str) -> bool:
    """Fuzzy-match names from email vs stored connection.

    Handles partial matches: 'John Doe' matches 'John D.',
    'John' matches 'John Doe', etc.
    """
    en = _normalize(email_name)
    sn = _normalize(stored_name)

    if en == sn:
        return True

    # Check if one name contains the other
    if en in sn or sn in en:
        return True

    # Check first+last name matching (handles middle names, initials)
    en_parts = en.split()
    sn_parts = sn.split()

    if len(en_parts) >= 2 and len(sn_parts) >= 2:
        # First name and last name match
        if en_parts[0] == sn_parts[0] and en_parts[-1] == sn_parts[-1]:
            return True
        # First name matches and last initial matches
        if en_parts[0] == sn_parts[0] and en_parts[-1][0] == sn_parts[-1][0]:
            return True

    # First name only match (if one side has only first name)
    if len(en_parts) == 1 or len(sn_parts) == 1:
        if en_parts[0] == sn_parts[0]:
            return True

    return False


async def _send_reminder_email(
    connection: LinkedInConnection, credentials, user_email: str
) -> bool:
    """Send a reminder email to the user about the accepted connection."""
    try:
        service = _build_gmail_service(credentials)

        subject = f"Message {connection.name} on LinkedIn!"
        html_body = f"""\
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #0a66c2;">🤝 {connection.name} accepted your connection!</h2>
  <p><strong>You wanted to connect because:</strong></p>
  <blockquote style="border-left: 3px solid #0a66c2; padding-left: 12px; margin-left: 0; color: #555;">
    {connection.reason}
  </blockquote>
  <p>
    <a href="{connection.profile_url}" style="display: inline-block; background: #0a66c2; color: white; padding: 10px 20px; border-radius: 20px; text-decoration: none; font-weight: 600;">
      Message {connection.name.split()[0]} on LinkedIn
    </a>
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 24px;">
    Sent by Alfred — your silent guardian.
  </p>
</body>
</html>"""

        message = MIMEText(html_body, "html")
        message["to"] = user_email
        message["from"] = user_email
        message["subject"] = subject

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute(),
        )
        logger.info("Sent reminder email for connection: %s", connection.name)
        return True
    except Exception as exc:
        logger.warning("Failed to send reminder email for %s: %s", connection.name, exc)
        return False


async def check_linkedin_acceptances(session: AsyncSession, settings: Settings) -> int:
    """Check Gmail for LinkedIn acceptance emails and match against pending connections.

    Returns the number of new acceptances found.
    """
    creds = await get_credentials(session, settings)
    if not creds:
        return 0

    pending = await linkedin_connection_service.get_pending_connections(session)
    if not pending:
        return 0

    try:
        service = _build_gmail_service(creds)
    except Exception as exc:
        logger.warning("Failed to build Gmail service: %s", exc)
        return 0

    # Search for LinkedIn acceptance emails from the last day
    query = 'from:linkedin.com subject:"accepted your invitation" newer_than:1d'

    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: service.users().messages().list(
                userId="me", q=query, maxResults=20
            ).execute(),
        )
    except Exception as exc:
        logger.warning("Gmail search failed: %s", exc)
        return 0

    messages = results.get("messages", [])
    if not messages:
        return 0

    matched = 0

    for msg_meta in messages:
        try:
            msg = await loop.run_in_executor(
                None,
                lambda mid=msg_meta["id"]: service.users().messages().get(
                    userId="me", id=mid, format="metadata",
                    metadataHeaders=["Subject"],
                ).execute(),
            )

            headers = msg.get("payload", {}).get("headers", [])
            subject = next(
                (h["value"] for h in headers if h["name"].lower() == "subject"), ""
            )

            email_name = _extract_name_from_subject(subject)
            if not email_name:
                continue

            # Match against pending connections
            for conn in pending:
                if _names_match(email_name, conn.name):
                    conn.status = "accepted"
                    conn.accepted_at = datetime.now(timezone.utc)
                    await session.commit()

                    logger.info(
                        "LinkedIn connection accepted: %s (matched '%s')",
                        conn.name,
                        email_name,
                    )

                    # Send push notification
                    subs = await push_service.get_all_subscriptions(session)
                    for sub in subs:
                        await push_service.send_push(
                            sub,
                            f"🤝 {conn.name} accepted your connection!",
                            f"You connected for: {conn.reason}",
                            session=session,
                        )

                    # Send reminder email
                    # Get user's email from the Gmail profile
                    try:
                        profile = await loop.run_in_executor(
                            None,
                            lambda: service.users().getProfile(userId="me").execute(),
                        )
                        user_email = profile.get("emailAddress", "")
                        if user_email:
                            await _send_reminder_email(conn, creds, user_email)
                    except Exception as exc:
                        logger.warning("Could not get user email for reminder: %s", exc)

                    matched += 1
                    # Remove from pending list so we don't match again
                    pending.remove(conn)
                    break

        except Exception as exc:
            logger.warning("Error processing Gmail message: %s", exc)

    return matched


async def linkedin_poll_loop(session_factory, settings: Settings) -> None:
    """Background task: periodically checks Gmail for LinkedIn acceptance emails."""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        try:
            async with session_factory() as session:
                found = await check_linkedin_acceptances(session, settings)
                if found:
                    logger.info("LinkedIn poll: found %d new acceptances", found)
        except Exception as exc:
            logger.error("LinkedIn poll loop error: %s", exc)
