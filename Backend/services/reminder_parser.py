import calendar
import re
from datetime import datetime, timedelta
from services.ai100_client import chat_completion_raw, is_api_configured

VALID_CONDITION_TYPES = ["price_above", "price_below", "percent_change", "time_based", "custom"]
COMPANY_TO_TICKER = {
    "apple": "AAPL",
    "airbnb": "ABNB",
    "microsoft": "MSFT",
    "nvidia": "NVDA",
    "tesla": "TSLA",
    "amazon": "AMZN",
    "alphabet": "GOOGL",
    "google": "GOOGL",
    "meta": "META",
    "qualcomm": "QCOM",
    "amd": "AMD",
    "intel": "INTC",
}
TICKER_STOPWORDS = {
    "a", "an", "and", "at", "below", "buy", "current", "drop", "drops", "fall", "falls",
    "for", "from", "gain", "gains", "go", "goes", "if", "it", "me", "my", "of",
    "on", "or", "price", "review", "sell", "so", "the", "to", "under", "up", "when",
}


def parse_reminder(text: str) -> dict:
    """
    Uses the shared AI100 LLM client to extract structured intent from
    a plain-English stock reminder.

    Falls back to regex-based parsing if the API key is missing or the
    LLM call fails.

    Returns a dict with:
        ticker, company_name, action, condition_type,
        target_price, percent_change, trigger_time, notes, _source
    """
    if not is_api_configured():
        print("Warning: AI100 API not configured. Using regex fallback for reminder parsing.")
        return _regex_fallback(text)

    system_prompt = (
        "You are a financial assistant that extracts structure from stock reminders. "
        "Respond using ONLY the exact labeled format requested. "
        "Do not add commentary, markdown, or extra text."
    )

    user_prompt = f"""Parse this stock reminder and respond with EXACTLY these lines:

TICKER: <uppercase stock symbol or null>
COMPANY_NAME: <full company name or null>
ACTION: <buy, sell, review, hold, or similar>
CONDITION_TYPE: <price_above, price_below, percent_change, time_based, or custom>
TARGET_PRICE: <number or null>
PERCENT_CHANGE: <number, negative for drops, or null>
TRIGGER_TIME: <ISO 8601 datetime or null>
NOTES: <short note or null>

Rules:
- If the reminder mentions a company name instead of a ticker, infer the ticker.
- For "drops 5%" or "falls 5%" style reminders, use CONDITION_TYPE: percent_change and a negative percentage.
- For "gains 5%" or "up 5%" style reminders, use CONDITION_TYPE: percent_change and a positive percentage.
- For reminders like "in 2 months", "in 3 days", "tomorrow", or "next week", use CONDITION_TYPE: time_based.
- For time-based reminders, set TRIGGER_TIME to the resolved ISO 8601 datetime based on the current time.
- TARGET_PRICE should only be set if the user explicitly provided a price.
- If unsure, use custom.

Reminder: "{text}" """

    raw_result = chat_completion_raw(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.1,
        max_tokens=180,
    )

    if raw_result is None:
        raise ValueError("AI reminder parsing failed")

    result = _parse_ai_response(raw_result)

    # Normalise condition_type to allowed values
    if result.get("condition_type") not in VALID_CONDITION_TYPES:
        result["condition_type"] = "custom"

    if not result.get("ticker"):
        result["ticker"] = _infer_ticker_from_text_or_company(text, result.get("company_name"))

    result = _repair_ai_result(text, result)

    result["_source"] = "llm"
    return result


def _parse_ai_response(raw: str) -> dict:
    def extract(label: str) -> str | None:
        match = re.search(rf"^{label}:\s*(.+)$", raw, re.MULTILINE | re.IGNORECASE)
        if not match:
            return None
        value = match.group(1).strip()
        return None if value.lower() == "null" else value

    ticker = extract("TICKER")
    company_name = extract("COMPANY_NAME")
    condition_type = (extract("CONDITION_TYPE") or "custom").lower()
    target_price_raw = extract("TARGET_PRICE")
    percent_change_raw = extract("PERCENT_CHANGE")

    return {
        "ticker": _normalize_ticker_value(ticker),
        "company_name": company_name,
        "action": extract("ACTION") or "review",
        "condition_type": condition_type,
        "target_price": float(target_price_raw) if target_price_raw else None,
        "percent_change": float(percent_change_raw) if percent_change_raw else None,
        "trigger_time": extract("TRIGGER_TIME"),
        "notes": extract("NOTES"),
    }


def _normalize_ticker_value(value: str | None) -> str | None:
    if not value:
        return None

    cleaned = value.strip().upper()
    if cleaned == "NULL":
        return None

    exact_match = re.fullmatch(r"[A-Z]{1,5}", cleaned)
    if exact_match:
        return cleaned

    embedded_match = re.search(r"\b([A-Z]{1,5})\b", cleaned)
    if embedded_match:
        candidate = embedded_match.group(1)
        if candidate.lower() not in TICKER_STOPWORDS:
            return candidate

    return None


def _infer_ticker_from_text_or_company(text: str, company_name: str | None) -> str | None:
    if company_name:
        lowered_company = company_name.lower()
        for known_company, ticker in COMPANY_TO_TICKER.items():
            if known_company in lowered_company:
                return ticker

    return _extract_ticker(text)


def _repair_ai_result(text: str, result: dict) -> dict:
    lowered = text.lower()
    percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text, re.IGNORECASE)
    explicit_price = re.search(r"\$\s*\d+(?:\.\d+)?", text)
    parsed_trigger_time = _parse_relative_time(lowered)

    if not result.get("action"):
        if "buy" in lowered:
            result["action"] = "buy"
        elif "sell" in lowered:
            result["action"] = "sell"
        else:
            result["action"] = "review"

    if parsed_trigger_time:
        result["condition_type"] = "time_based"
        result["trigger_time"] = parsed_trigger_time
        result["target_price"] = None
        result["percent_change"] = None
    elif percent_match and not explicit_price:
        percent_value = float(percent_match.group(1))
        is_negative = any(word in lowered for word in ["drop", "drops", "fall", "falls", "below", "under", "down", "lose"])
        result["condition_type"] = "percent_change"
        result["percent_change"] = -percent_value if is_negative else percent_value
        result["target_price"] = None

    if result.get("ticker"):
        normalized = _normalize_ticker_value(result.get("ticker"))
        result["ticker"] = normalized if normalized else _infer_ticker_from_text_or_company(text, result.get("company_name"))

    return result


def _parse_relative_time(text: str) -> str | None:
    now = datetime.now()

    relative_match = re.search(
        r"\b(?:in\s+)?(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b",
        text,
        re.IGNORECASE,
    )
    if relative_match:
        amount = int(relative_match.group(1))
        unit = relative_match.group(2).lower()

        if unit.startswith("minute"):
            return (now + timedelta(minutes=amount)).isoformat()
        if unit.startswith("hour"):
            return (now + timedelta(hours=amount)).isoformat()
        if unit.startswith("day"):
            return (now + timedelta(days=amount)).isoformat()
        if unit.startswith("week"):
            return (now + timedelta(weeks=amount)).isoformat()
        if unit.startswith("month"):
            return _add_months(now, amount).isoformat()

    if re.search(r"\btomorrow\b", text):
        return (now + timedelta(days=1)).isoformat()
    if re.search(r"\bnext week\b", text):
        return (now + timedelta(weeks=1)).isoformat()
    if re.search(r"\bnext month\b", text):
        return _add_months(now, 1).isoformat()

    return None


def _add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _regex_fallback(text: str) -> dict:
    """
    Simple regex-based extraction used when the LLM API is unavailable.
    """
    ticker = _extract_ticker(text)
    price_above = re.search(
        r"(?:above|over|reaches?|hits?)\s*\$?(\d+(?:\.\d{2})?)", text, re.IGNORECASE
    )
    price_below = re.search(
        r"(?:below|under|drops?\s*(?:to)?)\s*\$?(\d+(?:\.\d{2})?)", text, re.IGNORECASE
    )
    percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text, re.IGNORECASE)

    condition_type = "custom"
    target_price = None
    percent_change = None
    action = "review"

    if price_above:
        condition_type = "price_above"
        target_price = float(price_above.group(1))
        if "sell" in text.lower():
            action = "sell"
    elif price_below:
        condition_type = "price_below"
        target_price = float(price_below.group(1))
        if "buy" in text.lower():
            action = "buy"
    elif percent_match:
        condition_type = "percent_change"
        val = float(percent_match.group(1))
        is_negative = any(w in text.lower() for w in ["drop", "fall", "down", "lose"])
        percent_change = -val if is_negative else val

    return {
        "ticker": ticker,
        "company_name": None,
        "action": action,
        "condition_type": condition_type,
        "target_price": target_price,
        "percent_change": percent_change,
        "trigger_time": None,
        "notes": text,
        "_source": "fallback_regex",
    }


def _extract_ticker(text: str) -> str | None:
    lowered = text.lower()
    for company_name, ticker in COMPANY_TO_TICKER.items():
        if re.search(rf"\b{re.escape(company_name)}\b", lowered):
            return ticker

    candidates = re.findall(r"\b([A-Za-z]{1,5})\b", text)
    for candidate in candidates:
        lowered_candidate = candidate.lower()
        if lowered_candidate in TICKER_STOPWORDS:
            continue
        return candidate.upper()

    return None
