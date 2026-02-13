from fastapi import APIRouter
from pydantic import BaseModel
from services.notification_service import generate_all_notifications
from database import dismiss_notification, get_dismissed_notification_ids

router = APIRouter()


@router.get("/notifications", tags=["Notifications"])
def get_notifications():
    """Generate any new notifications, then return today's non-dismissed list."""
    all_notifications = generate_all_notifications()
    dismissed_ids = get_dismissed_notification_ids()
    return [n for n in all_notifications if n["id"] not in dismissed_ids]


class DismissRequest(BaseModel):
    notification_id: str


@router.post("/notifications/dismiss", tags=["Notifications"])
def dismiss(req: DismissRequest):
    """Persist a dismissed notification so it never reappears."""
    dismiss_notification(req.notification_id)
    return {"message": "Notification dismissed"}


@router.post("/notifications/clear-all", tags=["Notifications"])
def clear_all():
    """Dismiss all current notifications."""
    all_notifications = generate_all_notifications()
    dismissed_ids = get_dismissed_notification_ids()
    for n in all_notifications:
        if n["id"] not in dismissed_ids:
            dismiss_notification(n["id"])
    return {"message": "All notifications cleared"}
