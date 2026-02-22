import re
from services.ai100_client import chat_completion, is_api_configured

VALID_CONDITION_TYPES = ["price_above", "price_below", "percent_change", "time_based", "custom"]


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
        "You are a financial assistant. You MUST respond with ONLY a raw JSON object. "
        "Do NOT use function calls or tool calls. Do NOT wrap in markdown. "
        "Just output the raw JSON object directly as plain text."
    )

    user_prompt = f"""Parse this stock reminder into JSON with these exact fields:

{{"ticker": "AAPL", "company_name": "Apple Inc.", "action": "buy", "condition_type": "price_below", "target_price": 170.00, "percent_change": null, "trigger_time": null, "notes": "buy if price drops"}}

Rules:
- ticker: uppercase stock symbol, or null
- company_name: full name if known, or null
- action: "buy", "sell", "review", "hold", or similar
- condition_type: one of "price_above", "price_below", "percent_change", "time_based", "custom"
- target_price: number or null
- percent_change: number (negative if drop) or null
- trigger_time: ISO 8601 string or null
- notes: extra context or null

Reminder: "{text}"

Respond with ONLY the JSON object:"""

    result = chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.1,
        max_tokens=1024,
    )

    if result is None:
        return _regex_fallback(text)

    # Normalise condition_type to allowed values
    if result.get("condition_type") not in VALID_CONDITION_TYPES:
        result["condition_type"] = "custom"

    result["_source"] = "llm"
    return result


def _regex_fallback(text: str) -> dict:
    """
    Simple regex-based extraction used when the LLM API is unavailable.
    """
    ticker_match = re.search(r"\b([A-Z]{1,5})\b", text)
    price_above = re.search(
        r"(?:above|over|reaches?|hits?)\s*\$?(\d+(?:\.\d{2})?)", text, re.IGNORECASE
    )
    price_below = re.search(
        r"(?:below|under|drops?\s*(?:to)?)\s*\$?(\d+(?:\.\d{2})?)", text, re.IGNORECASE
    )
    percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text, re.IGNORECASE)

    ticker = ticker_match.group(1) if ticker_match else None
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
