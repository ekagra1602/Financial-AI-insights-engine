
import os
import requests
import json
import re
from fastapi import HTTPException

# Cirrascale AI Suite OpenAI-compatible endpoint
# Base URL should be https://aisuite.cirrascale.com/apis/v2
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Default model to use (can be configured)
AI100_MODEL = os.getenv("AI100_MODEL", "meta-llama/Llama-3.1-8B-Instruct")

VALID_SENTIMENTS = {"positive", "negative", "neutral"}
VALID_TONES = {"bullish", "bearish", "neutral"}

def analyze_text(text: str):
    """
    Sends text to Qualcomm AI100 (via Cirrascale) for summarization.
    Uses OpenAI-compatible chat completions API.
    """
    if not AI100_API_KEY:
        print("Warning: AI100_API_KEY not set. Using mock response.")
        return _mock_response(text)

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json"
    }

    # Better Prompt Engineering
    # 1. Clear role definition
    # 2. Strict constraints on JSON only
    # 3. Explicit schema definition
    # 4. Truncation handled safely before sending
    
    # Safety truncation
    # Llama 3 8B has 8k context, but we want to be safe and efficient
    truncated_text = text[:6000]

    system_prompt = """You are a financial analyst AI helper. 
You strictly output ONLY valid JSON. 
Do not include markdown formatting like ```json ... ```. 
Do not include any preamble or postscript.
If you cannot analyze the text, return a JSON with empty fields but valid structure."""

    user_prompt = f"""
    Analyze the following financial news article and extract key insights.
    
    Return a JSON object with EXACTLY this structure:
    {{
        "summary": "A concise summary of the article (max 3 sentences).",
        "sentiment": "positive, negative, or neutral",
        "tone": "bullish, bearish, or neutral",
        "keywords": ["list", "of", "key", "entities", "and", "terms"]
    }}

    Article Content:
    {truncated_text}
    """

    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,  # Low temperature for deterministic/strict output
        "max_tokens": 500
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        
        if response.status_code != 200:
            print(f"AI100 API Error: {response.status_code} - {response.text}")
            return _mock_response(text)
            
        data = response.json()
        
        if 'choices' not in data or not data['choices']:
            print(f"AI100 API returned unexpected format: {data}")
            return _mock_response(text)

        content = data['choices'][0]['message']['content']
        
        # Parse JSON from the content
        return _parse_llm_json(content, text)
        
    except Exception as e:
        print(f"Error calling AI100 API: {e}")
        return _mock_response(text)

def _parse_llm_json(content: str, original_text: str) -> dict:
    """
     robustly parses JSON from LLM output, handling common formatting issues.
    """
    try:
        # 1. Try direct parsing
        return _validate_and_normalize(json.loads(content), original_text)
    except json.JSONDecodeError:
        pass
    
    try:
        # 2. Try removing markdown code blocks
        clean_content = re.sub(r'```json\s*|\s*```', '', content).strip()
        return _validate_and_normalize(json.loads(clean_content), original_text)
    except json.JSONDecodeError:
        pass

    try:
        # 3. Try finding the first '{' and last '}'
        start = content.find('{')
        end = content.rfind('}')
        if start != -1 and end != -1:
            json_str = content[start:end+1]
            return _validate_and_normalize(json.loads(json_str), original_text)
    except json.JSONDecodeError:
        print(f"Failed to parse LLM JSON response: {content[:100]}...")
        pass

    # Fallback if all parsing fails
    return _mock_response(original_text)

def _validate_and_normalize(result: dict, original_text: str) -> dict:
    """
    Ensures the result has all required fields with valid values.
    """
    if not isinstance(result, dict):
        return _mock_response(original_text)

    # Summary
    if "summary" not in result or not result["summary"]:
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
