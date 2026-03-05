from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.reminder_parser import parse_reminder
from services.finnhub_client import get_finnhub_quote

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ReminderRequest(BaseModel):
    text: str


class ParsedReminder(BaseModel):
    ticker: Optional[str] = None
    company_name: Optional[str] = None
    action: Optional[str] = None
    condition_type: str = "custom"
    target_price: Optional[float] = None
    percent_change: Optional[float] = None
    trigger_time: Optional[str] = None
    current_price: Optional[float] = None
    notes: Optional[str] = None
    source: str = "llm"


class SaveReminderRequest(BaseModel):
    original_text: str
    ticker: str
    company_name: Optional[str] = None
    action: str = "Review and take action"
    condition_type: str = "custom"
    target_price: Optional[float] = None
    percent_change: Optional[float] = None
    trigger_time: Optional[str] = None
    custom_condition: Optional[str] = None
    current_price: Optional[float] = None
    notes: Optional[str] = None


class SavedReminder(BaseModel):
    id: str
    original_text: str
    ticker: str
    company_name: Optional[str] = None
    action: str
    status: str
    condition_type: str
    target_price: Optional[float] = None
    percent_change: Optional[float] = None
    trigger_time: Optional[str] = None
    custom_condition: Optional[str] = None
    created_at: str
    triggered_at: Optional[str] = None
    current_price: Optional[float] = None
    notes: Optional[str] = None


class ReminderStatusUpdate(BaseModel):
    status: str


class AlertResponse(BaseModel):
    id: str
    reminder_id: str
    ticker: str
    message: str
    triggered_at: str
    is_read: bool


# ── Parse endpoint (existing) ─────────────────────────────────────────────────

@router.post("/reminders/parse", response_model=ParsedReminder)
async def parse_reminder_text(request: ReminderRequest):
    """
    Accepts plain English text about a stock reminder.
    Uses AI100 LLM to extract structured intent (ticker, condition, action).
    Also fetches the current price for the detected ticker.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Reminder text cannot be empty")

    try:
        parsed = parse_reminder(request.text)

        ticker = parsed.get("ticker")
        current_price = None
        source = "llm" if parsed.get("_source") != "fallback_regex" else "regex_fallback"

        if ticker:
            try:
                quote = get_finnhub_quote(ticker)
                current_price = quote.get("c")
            except Exception as e:
                print(f"Could not fetch price for {ticker}: {e}")

        return ParsedReminder(
            ticker=ticker,
            company_name=parsed.get("company_name"),
            action=parsed.get("action"),
            condition_type=parsed.get("condition_type", "custom"),
            target_price=parsed.get("target_price"),
            percent_change=parsed.get("percent_change"),
            trigger_time=parsed.get("trigger_time"),
            current_price=current_price,
            notes=parsed.get("notes"),
            source=source,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse reminder: {str(e)}")


# ── CRUD endpoints ────────────────────────────────────────────────────────────

@router.post("/reminders", response_model=SavedReminder, status_code=201)
async def save_reminder(request: SaveReminderRequest):
    """Persist a parsed reminder and immediately check if the condition is already met."""
    import asyncio
    from database import create_reminder
    from services.price_monitor import check_single_reminder
    row = create_reminder(request.model_dump())
    # Fire-and-forget: check condition instantly without blocking the response
    asyncio.create_task(check_single_reminder(row))
    return SavedReminder(**row)


@router.get("/reminders", response_model=list[SavedReminder])
async def list_reminders():
    """Return all reminders, newest first."""
    from database import get_all_reminders
    return [SavedReminder(**r) for r in get_all_reminders()]


@router.get("/reminders/{reminder_id}", response_model=SavedReminder)
async def get_reminder(reminder_id: str):
    """Fetch a single reminder by ID."""
    from database import get_reminder_by_id
    row = get_reminder_by_id(reminder_id)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return SavedReminder(**row)


@router.patch("/reminders/{reminder_id}/status", response_model=SavedReminder)
async def update_status(reminder_id: str, body: ReminderStatusUpdate):
    """Update a reminder's status (cancel, trigger, expire)."""
    from database import update_reminder_status
    VALID_STATUSES = {"active", "triggered", "expired", "cancelled"}
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    row = update_reminder_status(reminder_id, body.status)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return SavedReminder(**row)


@router.delete("/reminders/{reminder_id}", status_code=204)
async def remove_reminder(reminder_id: str):
    """Hard-delete a reminder."""
    from database import delete_reminder
    deleted = delete_reminder(reminder_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")


# ── Alert endpoints ───────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertResponse])
async def list_alerts():
    """Return all alerts, newest first."""
    from database import get_all_alerts
    rows = get_all_alerts()
    return [AlertResponse(**{**r, "is_read": bool(r["is_read"])}) for r in rows]


@router.patch("/alerts/{alert_id}/read", response_model=AlertResponse)
async def read_alert(alert_id: str):
    """Mark an alert as read."""
    from database import mark_alert_read
    row = mark_alert_read(alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse(**{**row, "is_read": bool(row["is_read"])})


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(alert_id: str):
    """Dismiss (hard-delete) an alert."""
    from database import dismiss_alert
    deleted = dismiss_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
