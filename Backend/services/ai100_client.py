import os
import json
import re
import requests
from fastapi import HTTPException
from typing import Optional

# Cirrascale AI Suite OpenAI-compatible endpoint
# Base URL should be https://aisuite.cirrascale.com/apis/v2
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Default model to use (can be configured)
AI100_MODEL = os.getenv("AI100_MODEL", "DeepSeek-R1-Distill-Llama-70B")


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
    
    Every service that needs the LLM should call this instead of
    duplicating the HTTP / parsing logic.
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
        print(f"[AI100] Calling {url} with model={AI100_MODEL}")
        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code != 200:
            print(f"[AI100] Error {response.status_code}: {response.text[:500]}")
            return None

        data = response.json()
        message = data["choices"][0]["message"]
        content = message.get("content") or ""

        # If content is empty, the model may have returned tool_calls instead.
        # Try to extract JSON from tool_calls arguments as a fallback.
        if not content.strip() and "tool_calls" in message:
            print(f"[AI100] Model returned tool_calls instead of content: {json.dumps(message, indent=2)[:800]}")
            try:
                args_str = message["tool_calls"][0]["function"]["arguments"]
                if args_str and args_str.strip() and args_str.strip() != "{}":
                    return json.loads(args_str)
            except (KeyError, IndexError, json.JSONDecodeError):
                pass
            print("[AI100] Could not extract useful data from tool_calls")
            return None

        if not content.strip():
            print("[AI100] Empty content in response")
            return None

        # DeepSeek reasoning models wrap output in <think>...</think> — strip it
        cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        # Also strip markdown code fences
        cleaned = re.sub(r"```json\s*|\s*```", "", cleaned).strip()
        return json.loads(cleaned)

    except json.JSONDecodeError as e:
        print(f"[AI100] Response is not valid JSON: {e}")
        print(f"[AI100] Raw content: {content[:500]}")
        return None
    except Exception as e:
        print(f"[AI100] Unexpected error: {e}")
        return None


def analyze_text(text: str):
    """
    Sends text to Qualcomm AI100 (via Cirrascale) for summarization.
    Uses the shared chat_completion helper.
    """
    system_prompt = "You are a financial analyst AI helper. You output only valid JSON."
    user_prompt = f"""
    Analyze the following financial news article. 
    Provide a JSON response with the following fields:
    - summary: A concise summary of the article (max 3 sentences).
    - sentiment: 'positive', 'negative', or 'neutral'.
    - tone: 'bullish', 'bearish', or 'neutral'.
    - keywords: A list of key entities (companies, people, products).

    Article Content:
    {text[:4000]} 
    """

    result = chat_completion(system_prompt, user_prompt, temperature=0.3, max_tokens=500)
    return result if result else _mock_response(text)

def _mock_response(text: str):
    """
    Fallback mock response if API is unavailable.
    """
    summary = text[:300].strip()
    if len(text) > 300:
        summary += "..."
        
    return {
        "summary": summary,
        "sentiment": "neutral",
        "tone": "neutral",
        "keywords": ["Mock", "Data"]
    }
