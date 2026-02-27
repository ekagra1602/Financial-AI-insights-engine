from fastapi import APIRouter
from pydantic import BaseModel
from services.notification_service import generate_all_notifications
from database import (
    dismiss_notification,
    get_dismissed_notification_ids,
    get_all_alerts,
    mark_alert_read,
    get_all_reminders,
)

router = APIRouter()


def _alerts_as_notifications(dismissed_ids: set) -> list:
    """
    Convert unread, non-dismissed alerts (triggered reminders) into
    the unified Notification shape so they appear in the panel.
    """
    # Build a lookup of reminder details so we can add context to each alert
    reminders_by_id = {r["id"]: r for r in get_all_reminders()}

    notifications = []
    for alert in get_all_alerts():
        alert_id = f"ALERT_{alert['id']}"

        # Skip if already dismissed through the notification panel
        if alert_id in dismissed_ids:
            continue

        # Skip if already read/dismissed via the Reminders page
        if alert.get("is_read"):
            continue

        reminder = reminders_by_id.get(alert.get("reminder_id"), {})
        ticker = alert.get("ticker", "")
        message = alert.get("message", "")
        triggered_at = alert.get("triggered_at", "")

        # Build a human-readable title from the reminder condition
        ctype = reminder.get("condition_type", "")
        target = reminder.get("target_price")
        pct = reminder.get("percent_change")
        if ctype == "price_above" and target:
            title = f"Price above ${target:.2f}"
        elif ctype == "price_below" and target:
            title = f"Price below ${target:.2f}"
        elif ctype == "percent_change" and pct is not None:
            title = f"{'▲' if pct > 0 else '▼'} {abs(pct):.1f}% move"
        elif ctype == "time_based":
            title = "Scheduled reminder"
        else:
            title = "Reminder triggered"

        notifications.append({
            "id": alert_id,
            "type": "REMINDER_ALERT",
            "symbol": ticker,
            "title": title,
            "message": message,
            "direction": "neutral",
            "percentChange": 0,
            "timestamp": triggered_at[:16].replace("T", " ") if triggered_at else "",
        })

    return notifications


@router.get("/notifications", tags=["Notifications"])
def get_notifications():
    dismissed_ids = get_dismissed_notification_ids()

    # All market-move / news-briefing notifications
    market_notifications = [
        n for n in generate_all_notifications()
        if n["id"] not in dismissed_ids
    ]

    # Triggered reminder alerts merged in
    alert_notifications = _alerts_as_notifications(dismissed_ids)

    # Combine and return (alerts first — they are actionable)
    return alert_notifications + market_notifications


class DismissRequest(BaseModel):
    notification_id: str


@router.post("/notifications/dismiss", tags=["Notifications"])
def dismiss(req: DismissRequest):
    nid = req.notification_id
    # Persist the dismissal in the dismissed_notifications table
    dismiss_notification(nid)
    # If this was an alert notification, also mark the alert row as read
    if nid.startswith("ALERT_"):
        alert_id = nid[len("ALERT_"):]
        mark_alert_read(alert_id)
    return {"message": "Notification dismissed"}


@router.post("/notifications/clear-all", tags=["Notifications"])
def clear_all():
    dismissed_ids = get_dismissed_notification_ids()

    # Dismiss all market notifications
    for n in generate_all_notifications():
        if n["id"] not in dismissed_ids:
            dismiss_notification(n["id"])

    # Mark all unread alerts as read too
    for alert in get_all_alerts():
        if not alert.get("is_read"):
            mark_alert_read(alert["id"])
            dismiss_notification(f"ALERT_{alert['id']}")

    return {"message": "All notifications cleared"}
