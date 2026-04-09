import os
import re
import json
import requests
from typing import Optional
from fastapi import HTTPException

# Cirrascale AI Suite OpenAI-compatible endpoint
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Default model to use (can be configured)
AI100_MODEL = os.getenv("AI100_MODEL", "DeepSeek-R1-Distill-Llama-70B")

# Maximum retries for JSON parsing failures
MAX_RETRIES = 2


def is_api_configured() -> bool:
    """Check whether the AI100 API key is available."""
    return bool(AI100_API_KEY)


def chat_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 500,
) -> Optional[dict]:
    """
    Generic reusable wrapper around the AI100 chat completions endpoint.
    Sends the given system + user prompts, parses the JSON response, and
    returns the result dict.  Returns None on any failure.
    Used by reminder_parser (and any other service that needs the LLM).
    """
    if not AI100_API_KEY:
        return None

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "tool_choice": "none",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"[AI100] Error {response.status_code}: {response.text[:500]}")
            return None

        data = response.json()
        message = data["choices"][0]["message"]
        content = (message.get("content") or "").strip()

        if not content and "tool_calls" in message:
            try:
                args_str = message["tool_calls"][0]["function"].get("arguments", "{}")
                if args_str and args_str.strip() and args_str.strip() != "{}":
                    return json.loads(args_str)
            except (KeyError, IndexError, json.JSONDecodeError):
                pass
            return None

        if not content:
            return None

        cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        cleaned = re.sub(r"```json\s*|\s*```", "", cleaned).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[AI100] JSON parse error: {e}")
        return None
    except Exception as e:
        print(f"[AI100] Error: {e}")
        return None


def chat_completion_raw(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 500,
) -> Optional[str]:
    """
    Same API call as chat_completion, but returns raw text content instead of
    forcing JSON parsing. Useful for prompts that ask for strict labeled text.
    """
    if not AI100_API_KEY:
        return None

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "tool_choice": "none",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"[AI100] Error {response.status_code}: {response.text[:500]}")
            return None

        data = response.json()
        message = data["choices"][0]["message"]
        content = (message.get("content") or "").strip()

        if not content and "tool_calls" in message:
            try:
                return message["tool_calls"][0]["function"].get("arguments", "").strip() or None
            except (KeyError, IndexError):
                return None

        if not content:
            return None

        cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", cleaned).strip()
        return cleaned or None
    except Exception as e:
        print(f"[AI100] Error: {e}")
        return None


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
    Handles: bare JSON, markdown fences, leading/trailing text.
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

    raise ValueError(f"Could not extract JSON from response: {raw[:200]}...")


# ─── Main Function ───────────────────────────────────────────────────────────

def analyze_text(text: str) -> dict:
    """
    Sends text to Qualcomm AI100 (via Cirrascale) for summarization and analysis.
    Returns dict with keys: summary, sentiment, tone, keywords.
    Retries up to MAX_RETRIES times if JSON parsing fails.
    """
    if not AI100_API_KEY:
        print("⚠️  AI100_API_KEY not set — returning mock response.")
        return _mock_response(text)

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
    print(f"   System: {SYSTEM_PROMPT[:100]}...")
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

    # All retries exhausted
    print(f"   ❌ All {MAX_RETRIES} attempts failed. Last error: {last_error}")
    print(f"   Falling back to mock response.")
    print("─" * 60)
    return _mock_response(text)


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


def _mock_response(text: str) -> dict:
    """
    Fallback mock response when the API is unavailable or all retries fail.
    """
    summary = text[:300].strip()
    if len(text) > 300:
        summary += "..."
    return {
        "summary": summary,
        "sentiment": "neutral",
        "tone": "neutral",
        "keywords": [],
    }



# ─── Lightweight Summary-Only Function ───────────────────────────────────────

SUMMARY_ONLY_PROMPT = """Summarize the following financial news article in 1-2 sentences. Be concise and factual. Return ONLY the summary text, nothing else.

Article:
{article_text}"""

def summarize_only(text: str) -> str:
    """
    Lightweight summary: 1-2 sentences, no sentiment/tone/keywords.
    Used for news briefing notifications.
    Returns just the summary string.
    """
    if not AI100_API_KEY:
        return text[:200].strip() + ("..." if len(text) > 200 else "")

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": "You are a concise financial news summarizer. Return only the summary."},
            {"role": "user", "content": SUMMARY_ONLY_PROMPT.format(article_text=text[:3000])},
        ],
        "temperature": 0.1,
        "max_tokens": 150,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"].get("content", "").strip()
            if content:
                return content
    except Exception as e:
        print(f"  [summarize_only] Error: {e}")

    # Fallback: truncate original text
    return text[:200].strip() + ("..." if len(text) > 200 else "")

def _call_chat_completion(messages, temperature: float = 0.7, max_tokens: int = 600):
    if not AI100_API_KEY:
        return None

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": AI100_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"AI100 API Error: {response.status_code} - {response.text}")
            return None

        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Error in _call_chat_completion: {e}")
        return None

def get_chat_response(message: str, history=None):
    """
    Sends a general chat message to Qualcomm AI100.
    """
    if not AI100_API_KEY:
        return "I'm sorry, but I can't answer that right now because my AI brain (API Key) is missing."

    system_message = {"role": "system", "content": "You are a friendly and wise financial mentor. Your goal is to give clear, actionable advice that feels like a conversation. \n\nStyle Guide:\n- Start with a friendly hook or direct answer, maybe an emoji.\n- Use **Markdown** for formatting.\n- Use numbered headers (e.g., `### 1. Step Name`) for main points.\n- Use bold text for key concepts.\n- Use bullet points for details.\n- Use horizontal rules (`---`) to separate major sections.\n- Keep the tone encouraging but realistic.\n- If the user asks about investing, focus on safety and basics first."}
    
    messages = [system_message]
    
    # Prepend history if available (limit to last 10 messages to avoid token issues)
    if history:
        for m in history[-10:]:
            # Convert ChatMessage objects/dicts to the required format
            if isinstance(m, dict):
                role = m.get('role')
                content = m.get('content')
            else:
                # Handle Pydantic objects or other objects with attributes
                role = getattr(m, 'role', None)
                content = getattr(m, 'content', None)
            
            if role and content:
                messages.append({"role": role, "content": content})
            
    messages.append({"role": "user", "content": message})

    try:
        return _call_chat_completion(messages, temperature=0.7, max_tokens=600)
        
    except Exception as e:
        print(f"Error calling AI100 API: {e}")
        return "I'm having trouble connecting to the AI service right now."


def simplify_for_eli5(text: str):
    """
    Rewrites financial content in simple language suitable for a beginner/ELI5 mode.
    """
    if not text:
        return text

    if not AI100_API_KEY:
        return f"### ELI5 Version\n{text}"

    messages = [
        {
            "role": "system",
            "content": (
                "You explain finance in simple language for beginners. "
                "Keep facts accurate, avoid jargon, and use short sentences. "
                "Use Markdown and keep structure readable."
            )
        },
        {
            "role": "user",
            "content": (
                "Rewrite the following content as Explain Like I'm 5. "
                "Do not invent facts.\n\n"
                f"{text}"
            )
        }
    ]

    try:
        return _call_chat_completion(messages, temperature=0.4, max_tokens=700)
    except Exception as e:
        print(f"Error simplifying text for ELI5: {e}")
        return text


def improve_news_summary(summary_markdown: str, ticker: str = ""):
    """
    Improve clarity and usefulness of generated news summaries while preserving facts.
    """
    if not summary_markdown:
        return summary_markdown

    if not AI100_API_KEY:
        return summary_markdown

    ticker_context = ticker or "Market"
    messages = [
        {
            "role": "system",
            "content": (
                "You are a financial news editor. Rewrite summaries to be clearer and more useful "
                "for investors without adding new facts."
            )
        },
        {
            "role": "user",
            "content": (
                f"Improve this {ticker_context} news summary.\n"
                "Requirements:\n"
                "- Keep every factual claim grounded in the original text\n"
                "- For each article include: Why it matters, Key risk, and Investor takeaway\n"
                "- Use concise markdown headings and bullets\n\n"
                f"{summary_markdown}"
            )
        }
    ]

    try:
        return _call_chat_completion(messages, temperature=0.35, max_tokens=900)
    except Exception as e:
        print(f"Error improving news summary: {e}")
        return summary_markdown

def generate_aggregated_summary(articles, ticker: str = ""):
    """
    Generates a very concise high-level overview of multiple news articles.
    """
    if not articles:
        return None
    
    if not AI100_API_KEY:
        return "I've gathered the latest news for you. Here are the core details."

    ticker_context = ticker or "Market"
    
    # Prepare a list of headlines and short summaries for the model
    context_parts = []
    for i, art in enumerate(articles[:5], 1):
        headline = art.get('headline', 'No Headline')
        summary = art.get('summary', '')
        context_parts.append(f"{i}. {headline}: {summary[:150]}...")
    
    context_text = "\n".join(context_parts)

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert financial journalist. Your goal is to provide a single, "
                "punchy, high-level sentence that summarizes the overall trend from multiple headlines."
            )
        },
        {
            "role": "user",
            "content": (
                f"Based on these {ticker_context} news articles, provide one concise sentence "
                "starting with 'Overall:' that summarizes the key takeaway.\n\n"
                f"{context_text}"
            )
        }
    ]

    try:
        response = _call_chat_completion(messages, temperature=0.3, max_tokens=150)
        return response.strip()
    except Exception as e:
        print(f"Error generating aggregated summary: {e}")
        return f"I found {len(articles)} recent stories about {ticker_context}."

def extract_ticker_with_ai(message: str):
    """
    Uses LLM to extract the primary stock ticker from a user message.
    Returns only the ticker symbol (e.g., 'AAPL') or 'null'.
    """
    if not message or not AI100_API_KEY:
        return None

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert financial data extractor. Your task is to extract the primary "
                "US stock ticker mentioned or implied in the user message. "
                "For companies with widely known non-obvious tickers (e.g., Broadcom is AVGO, Google is GOOGL, Microsoft is MSFT, Apple is AAPL), ensure you return the CORRECT official ticker."
                "Do NOT guess or create short forms like 'BROAD' for Broadcom. If you are unsure of the official ticker, return 'null'."
                "Return ONLY the ticker symbol in uppercase characters, with no other text."
            )
        },
        {
            "role": "user",
            "content": f"Extract the stock ticker from this message: '{message}'"
        }
    ]

    try:
        response = _call_chat_completion(messages, temperature=0.1, max_tokens=10)
        ticker = response.strip().upper().replace('$', '')
        if ticker == 'NULL' or not ticker or len(ticker) > 5:
            return None
        return ticker
    except Exception as e:
        print(f"Error extracting ticker with AI: {e}")
        return None

def generate_stock_report(name: str, ticker: str, quote: dict, metrics: dict, news_items=None):
    """
    Generates a structured financial report matching the user's request.
    """
    if not AI100_API_KEY:
        return "I'm having trouble connecting to the AI service."

    # Prepare context
    stats_context = f"""
    Company: {name} ({ticker})
    Current Price: ${quote.get('c')}
    Change: {quote.get('d')} ({quote.get('dp')}%)
    Range Today: ${quote.get('l')} - ${quote.get('h')}
    Market Cap: {metrics.get('marketCapitalization') or metrics.get('market_cap', 'N/A')}
    52 Week range: {metrics.get('52WeekLow')} - {metrics.get('52WeekHigh')}
    """
    
    news_context = ""
    if news_items:
        news_context = "Latest News Headlines:\n"
        for i, art in enumerate(news_items[:3], 1):
            news_context += f"- {art.get('headline')}\n"

    prompt = f"""
    Generate a structured financial report for {name} ({ticker}).
    The report MUST follow this EXACT structure with Markdown:

    ### 🤖 AI Overview
    [Write a punchy, 2-sentence summary of how the stock is performing right now based on its price change and recent news.]

    ### 📊 Key Financial Highlights
    - [Highlight 1: e.g., current price trend]
    - [Highlight 2: e.g., market structure or MCap]
    - [Highlight 3: e.g., day range analysis]

    ### ⚡ Drivers & Risks
    - **Driver:** [What is pushing the stock up]
    - **Risk:** [What investors should watch out for]

    Use this data to inform your response:
    {stats_context}
    {news_context}
    """

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert financial analyst. Your goal is to provide a structured, "
                "easy-to-read report for investors. Be precise and avoid making up numbers."
            )
        },
        {
            "role": "user",
            "content": prompt
        }
    ]

    try:
        return _call_chat_completion(messages, temperature=0.5, max_tokens=700)
    except Exception as e:
        print(f"Error generating stock report: {e}")
        return "Failed to generate report."
