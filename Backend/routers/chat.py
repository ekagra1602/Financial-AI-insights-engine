from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.finnhub_client import get_finnhub_quote, get_finnhub_profile
from services.ai100_client import get_chat_response
import re

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

# Simple mapping for common tech stocks
TICKER_MAP = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "tesla": "TSLA",
    "nvidia": "NVDA",
    "meta": "META",
    "facebook": "META",
    "netflix": "NFLX",
    "oracle": "ORCL",
    "intel": "INTC",
    "amd": "AMD",
    "qualcomm": "QCOM",
    "qcom": "QCOM"
}

def extract_ticker(message: str):
    # 1. Check for explicit tickers (uppercase, 2-5 chars)
    # This regex looks for words that are all caps and 2-5 letters long
    # We exclude common words like "WHAT", "HOW", "THE", "WHO"
    potential_tickers = re.findall(r'\b[A-Z]{2,5}\b', message)
    common_words = {"WHAT", "HOW", "THE", "WHO", "WHY", "WHEN", "IS", "ARE", "DO", "DOES", "CAN", "WILL"}
    
    for t in potential_tickers:
        if t not in common_words:
            return t

    # 2. Check for company names in the map
    message_lower = message.lower()
    for name, ticker in TICKER_MAP.items():
        if name in message_lower:
            return ticker
            
    return None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    message = request.message
    ticker = extract_ticker(message)
    
    # ROUTING LOGIC
    if ticker:
        # PATH A: Stock related -> Finnhub
        try:
            quote = get_finnhub_quote(ticker)
            profile = get_finnhub_profile(ticker)
            
            name = profile.get('name', ticker)
            price = quote.get('c')
            change = quote.get('d')
            percent = quote.get('dp')
            high = quote.get('h')
            low = quote.get('l')
            
            # Determine direction and color
            direction = "up" if change >= 0 else "down"
            emoji = "🟢" if change >= 0 else "🔴"
            sign = "+" if change >= 0 else "-"
            
            # format large numbers
            mcap = profile.get('marketCapitalization', 0)
            if mcap > 1000:
                mcap_str = f"${mcap/1000:.2f}T"
            else:
                mcap_str = f"${mcap:.2f}B"

            industry = profile.get('finnhubIndustry', 'N/A')

            response = (
                f"### {emoji} {name} ({ticker})\n"
                f"**Price:** ${price} ({sign}{abs(change):.2f} / {sign}{percent:.2f}%)\n\n"
                f"**Details:**\n"
                f"• **Range:** ${low} - ${high}\n"
                f"• **Market Cap:** {mcap_str}\n"
                f"• **Industry:** {industry}\n"
            )
            return {"response": response, "source": "finnhub", "ticker": ticker}
            
        except Exception as e:
            # Fallback to AI if Finnhub fails or ticker is invalid
            print(f"Finnhub lookup failed for {ticker}: {e}")
            ai_response = get_chat_response(message)
            return {"response": ai_response, "source": "ai100"}
            
    else:
        # PATH B: General question -> AI100
        ai_response = get_chat_response(message)
        return {"response": ai_response, "source": "ai100"}
