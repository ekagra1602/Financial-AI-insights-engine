from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.reminder_parser import parse_reminder
from services.finnhub_client import get_finnhub_quote

router = APIRouter()


class ReminderRequest(BaseModel):
    text: str


class ParsedReminder(BaseModel):
    ticker: str | None = None
    company_name: str | None = None
    action: str | None = None
    condition_type: str = "custom"
    target_price: float | None = None
    percent_change: float | None = None
    trigger_time: str | None = None
    current_price: float | None = None
    notes: str | None = None
    source: str = "llm"


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
        # Step 1: Use LLM to parse natural language into structured data
        parsed = parse_reminder(request.text)

        ticker = parsed.get("ticker")
        current_price = None
        source = "llm" if parsed.get("_source") != "fallback_regex" else "regex_fallback"

        # Step 2: Fetch real-time price from Finnhub if we got a ticker
        if ticker:
            try:
                quote = get_finnhub_quote(ticker)
                current_price = quote.get("c")  # "c" = current price in Finnhub
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
