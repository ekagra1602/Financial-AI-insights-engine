import os
import requests
from fastapi import HTTPException

# Cirrascale AI Suite OpenAI-compatible endpoint
# Base URL should be https://aisuite.cirrascale.com/apis/v2
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Default model to use (can be configured)
AI100_MODEL = os.getenv("AI100_MODEL", "meta-llama/Llama-3.1-8B-Instruct")

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
    
    # Prompt engineering for summarization and metadata extraction
    prompt = f"""
    Analyze the following financial news article. 
    Provide a JSON response with the following fields:
    - summary: A concise summary of the article (max 3 sentences).
    - sentiment: 'positive', 'negative', or 'neutral'.
    - tone: 'bullish', 'bearish', or 'neutral'.
    - keywords: A list of key entities (companies, people, products).

    Article Content:
    {text[:4000]} 
    """
    # Truncate text to avoid token limits if necessary, though 8B model handles decent context.

    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": "You are a financial analyst AI helper. You output only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 500
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"AI100 API Error: {response.status_code} - {response.text}")
            return _mock_response(text)
            
        data = response.json()
        content = data['choices'][0]['message']['content']
        
        # Parse JSON from the content
        # The LLM might wrap it in markdown code blocks, so we clean it
        import json
        import re
        
        cleaned_content = re.sub(r'```json\s*|\s*```', '', content).strip()
        result = json.loads(cleaned_content)
        
        return result
        
    except Exception as e:
        print(f"Error calling AI100 API: {e}")
        return _mock_response(text)

    return {
        "summary": summary,
        "sentiment": "neutral",
        "tone": "neutral",
        "keywords": ["Mock", "Data"]
    }

def get_chat_response(message: str):
    """
    Sends a general chat message to Qualcomm AI100.
    """
    if not AI100_API_KEY:
        return "I'm sorry, but I can't answer that right now because my AI brain (API Key) is missing."

    url = f"{AI100_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": "You are a friendly and wise financial mentor. Your goal is to give clear, actionable advice that feels like a conversation. \n\nStyle Guide:\n- Start with a friendly hook or direct answer, maybe an emoji.\n- Use **Markdown** for formatting.\n- Use numbered headers (e.g., `### 1. Step Name`) for main points.\n- Use bold text for key concepts.\n- Use bullet points for details.\n- Use horizontal rules (`---`) to separate major sections.\n- Keep the tone encouraging but realistic.\n- If the user asks about investing, focus on safety and basics first."},
            {"role": "user", "content": message}
        ],
        "temperature": 0.7,
        "max_tokens": 600
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return f"Error: Unable to reach AI service ({response.status_code})"
            
        data = response.json()
        return data['choices'][0]['message']['content']
        
    except Exception as e:
        print(f"Error calling AI100 API: {e}")
        return "I'm having trouble connecting to the AI service right now."
