
import os
import re
import json
import requests
from fastapi import HTTPException

# Cirrascale AI Suite OpenAI-compatible endpoint
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Default model to use (can be configured)
AI100_MODEL = os.getenv("AI100_MODEL", "meta-llama/Llama-3.1-8B-Instruct")

# Maximum retries for JSON parsing failures
MAX_RETRIES = 2


# ─── Prompts ─────────────────────────────────────────────────────────────────
# NOTE: We intentionally avoid putting JSON templates/examples in the prompt
# because the Llama 3.1 model on the Cirrascale endpoint interprets JSON-like
# structures as tool call schemas, causing empty content with finish_reason=tool_calls.
# Instead, we use a plain-text structured format.

SYSTEM_PROMPT = (
    "You are a financial news analyst. "
    "When asked to analyze an article, respond using the exact format specified. "
    "Do not add any extra commentary or explanation."
)

USER_PROMPT_TEMPLATE = """Analyze the following financial news article and respond using EXACTLY this format (fill in the values):

SUMMARY: <write a concise summary in 2-3 sentences>
SENTIMENT: <choose exactly one: positive, negative, neutral>
TONE: <choose exactly one: bullish, bearish, neutral>
KEYWORDS: <comma-separated list of key entities like companies, people, products, tickers>

Important rules:
- SUMMARY must be 2-3 sentences maximum.
- SENTIMENT must be exactly one word: positive, negative, or neutral.
- TONE must be exactly one word: bullish, bearish, or neutral.
- KEYWORDS must be a comma-separated list.
- Do NOT add any other text or explanation.

Article:
{article_text}"""


# ─── Response Parsing ────────────────────────────────────────────────────────

def _parse_structured_response(raw: str) -> dict:
    """
    Parse the LLM's structured text response into a dict.
    Expected format:
        SUMMARY: ...
        SENTIMENT: positive|negative|neutral
        TONE: bullish|bearish|neutral
        KEYWORDS: kw1, kw2, kw3
    """
    result = {}

    # Extract SUMMARY (can be multi-line until the next label)
    summary_match = re.search(r'SUMMARY:\s*(.+?)(?=\n\s*(?:SENTIMENT|TONE|KEYWORDS):|$)', raw, re.DOTALL | re.IGNORECASE)
    if summary_match:
        result["summary"] = summary_match.group(1).strip()

    # Extract SENTIMENT
    sentiment_match = re.search(r'SENTIMENT:\s*(\w+)', raw, re.IGNORECASE)
    if sentiment_match:
        result["sentiment"] = sentiment_match.group(1).strip().lower()

    # Extract TONE
    tone_match = re.search(r'TONE:\s*(\w+)', raw, re.IGNORECASE)
    if tone_match:
        result["tone"] = tone_match.group(1).strip().lower()

    # Extract KEYWORDS
    keywords_match = re.search(r'KEYWORDS:\s*(.+)', raw, re.IGNORECASE)
    if keywords_match:
        raw_kw = keywords_match.group(1).strip()
        result["keywords"] = [kw.strip() for kw in raw_kw.split(",") if kw.strip()]

    if not result.get("summary"):
        raise ValueError(f"Could not parse structured response — no SUMMARY found in: {raw[:200]}...")

    return result


def _try_extract_json(raw: str) -> dict:
    """
    Fallback: try to extract JSON from the response if the model happens to return it.
    Handles: bare JSON, markdown fences, leading/trailing text, truncated JSON.
    Raises ValueError if no valid JSON found.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip()
    cleaned = re.sub(r'\s*```', '', cleaned).strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find { ... } block
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Try to fix truncated JSON (missing closing braces)
    start = cleaned.find('{')
    if start != -1:
        json_str = cleaned[start:].rstrip()
        open_braces = json_str.count('{') - json_str.count('}')
        open_brackets = json_str.count('[') - json_str.count(']')
        if open_braces > 0 or open_brackets > 0:
            json_str += ']' * open_brackets + '}' * open_braces
            try:
                result = json.loads(json_str)
                print(f"   ✅ Recovered truncated JSON (closed {open_brackets} brackets, {open_braces} braces)")
                return result
            except json.JSONDecodeError:
                pass

    raise ValueError(f"Could not extract JSON from response: {raw[:200]}...")


# ─── Main Function ───────────────────────────────────────────────────────────

def analyze_text(text: str):
    """
    Sends text to Qualcomm AI100 (via Cirrascale) for summarization and analysis.
    Returns dict with keys: summary, sentiment, tone, keywords.
    Returns None if all attempts fail (caller should skip the article).
    Retries up to MAX_RETRIES times if parsing fails.
    """
    if not AI100_API_KEY:
        print("⚠️  AI100_API_KEY not set — skipping article.")
        return None

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json",
    }

    # Build the user prompt with article text (truncated to ~3500 chars to stay within token limits)
    user_prompt = USER_PROMPT_TEMPLATE.format(article_text=text[:3500])

    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,  # Lower temperature for more deterministic output
        "max_tokens": 600,
    }

    # Log the prompt being sent
    print("─" * 60)
    print("📤 AI100 REQUEST")
    print(f"   Model:  {AI100_MODEL}")
    print(f"   Article length: {len(text)} chars (truncated to {min(len(text), 3500)})")
    print("─" * 60)

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            print(f"   Attempt {attempt}/{MAX_RETRIES} — HTTP {response.status_code}")

            if response.status_code != 200:
                print(f"   ❌ API Error: {response.status_code} — {response.text[:300]}")
                last_error = f"HTTP {response.status_code}"
                continue

            data = response.json()
            message = data["choices"][0]["message"]
            raw_content = message.get("content", "") or ""
            finish_reason = data["choices"][0].get("finish_reason", "unknown")

            print(f"   📥 Raw LLM response ({len(raw_content)} chars, finish_reason={finish_reason}):")
            if raw_content:
                print(f"   {raw_content[:400]}")

            # Handle tool_calls edge case (Llama sometimes routes JSON-like output here)
            if not raw_content and finish_reason == "tool_calls":
                tool_calls = message.get("tool_calls", [])
                print(f"   ⚠️  Model returned tool_calls instead of content ({len(tool_calls)} calls)")
                if tool_calls:
                    # Try to extract useful data from tool call arguments
                    args_str = tool_calls[0].get("function", {}).get("arguments", "{}")
                    print(f"   Tool call args: {args_str[:200]}")
                    if args_str and args_str != "{}":
                        try:
                            result = json.loads(args_str)
                            result = _validate_and_sanitize(result, text)
                            print(f"   ✅ Extracted from tool_calls: sentiment={result['sentiment']}")
                            print("─" * 60)
                            return result
                        except (json.JSONDecodeError, ValueError):
                            pass
                last_error = "Empty content with tool_calls finish_reason"
                continue

            if not raw_content:
                last_error = "Empty content in response"
                print(f"   ⚠️  Empty content, retrying...")
                continue

            # Try structured text parsing first (SUMMARY: / SENTIMENT: / etc.)
            try:
                result = _parse_structured_response(raw_content)
                result = _validate_and_sanitize(result, text)
                print(f"   ✅ Parsed (structured): sentiment={result['sentiment']}, tone={result['tone']}")
                print("─" * 60)
                return result
            except ValueError:
                pass

            # Fallback: try JSON extraction (in case model returned JSON anyway)
            try:
                result = _try_extract_json(raw_content)
                result = _validate_and_sanitize(result, text)
                print(f"   ✅ Parsed (JSON fallback): sentiment={result['sentiment']}, tone={result['tone']}")
                print("─" * 60)
                return result
            except ValueError as e:
                last_error = str(e)
                print(f"   ⚠️  Attempt {attempt} — could not parse response: {e}")

            payload["temperature"] = min(0.5, payload["temperature"] + 0.1)
            continue

        except (KeyError, json.JSONDecodeError) as e:
            last_error = str(e)
            print(f"   ⚠️  Attempt {attempt} error: {e}")
            payload["temperature"] = min(0.5, payload["temperature"] + 0.1)
            continue

        except requests.RequestException as e:
            last_error = str(e)
            print(f"   ❌ Network error on attempt {attempt}: {e}")
            continue

    # All retries exhausted — return None so the article is skipped
    print(f"   ❌ All {MAX_RETRIES} attempts failed. Last error: {last_error}")
    print(f"   Skipping this article.")
    print("─" * 60)
    return None


def _validate_and_sanitize(result: dict, original_text: str) -> dict:
    """
    Ensures the parsed result has all required keys with valid values.
    Fills in defaults for anything missing or malformed.
    """
    VALID_SENTIMENTS = {"positive", "negative", "neutral"}
    VALID_TONES = {"bullish", "bearish", "neutral"}

    # Summary
    if "summary" not in result or not isinstance(result["summary"], str) or not result["summary"].strip():
        result["summary"] = original_text[:300].strip() + ("..." if len(original_text) > 300 else "")

    # Sentiment
    sentiment = str(result.get("sentiment", "neutral")).lower().strip()
    result["sentiment"] = sentiment if sentiment in VALID_SENTIMENTS else "neutral"

    # Tone
    tone = str(result.get("tone", "neutral")).lower().strip()
    result["tone"] = tone if tone in VALID_TONES else "neutral"

    # Keywords
    keywords = result.get("keywords", [])
    if isinstance(keywords, list):
        result["keywords"] = [str(k) for k in keywords if k]
    else:
        result["keywords"] = []

    return result
