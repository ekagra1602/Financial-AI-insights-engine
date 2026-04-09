import json
import re
from pydantic import BaseModel
from typing import Optional, List, Dict
from services.ai100_client import _call_chat_completion

class ResolvedContext(BaseModel):
    intent: str
    ticker: Optional[str]
    contextual_reference: Optional[str]

def classify_and_resolve_prompt(message: str, history: List[Dict] = None) -> ResolvedContext:
    system_prompt = """
    You are a prompt router for a finance chatbot. 
    Review the chat history and the latest user message.
    Classify the message into one of four intents:: LIVE_DATA_OVERVIEW, FINANCIAL_NEWS, EXPLANATION, CONTEXTUAL_FOLLOWUP.
    - If the user asks for news, headlines, or updates, return FINANCIAL_NEWS.
    - If the user asks about a stock's price, how a company is doing, or general status, return LIVE_DATA_OVERVIEW.
    - Identify the target stock ticker. If the message is a CONTEXTUAL_FOLLOWUP (e.g. "summarize them"), you MUST extract and return the ticker that was being discussed in the chat history.
    - If the user makes a CONTEXTUAL_FOLLOWUP, explain what they are referring to explicitly in the contextual_reference field.
    
    Ensure you return pure JSON strictly covering these fields: {"intent": "...", "ticker": "... or null", "contextual_reference": "... or null"}
    """
    
    recent_history = history[-3:] if history else []
    
    user_context = f"History: {json.dumps(recent_history)}\nLatest Message: {message}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_context}
    ]
    
    try:
        response_text = _call_chat_completion(messages, temperature=0.1, max_tokens=150)
        # Clean JSON in case it's wrapped
        cleaned = re.sub(r'```json\s*|\s*```', '', response_text).strip()
        data = json.loads(cleaned)
        
        # Ensure fallback ticker format
        ticker = data.get("ticker", None)
        if str(ticker).lower() == "null" or not ticker:
            ticker = None
            
        return ResolvedContext(
            intent=data.get("intent", "EXPLANATION"),
            ticker=ticker,
            contextual_reference=data.get("contextual_reference")
        )
    except Exception as e:
        print(f"Error classifying prompt: {e}")
        return ResolvedContext(
            intent="EXPLANATION",
            ticker=None,
            contextual_reference=None
        )
