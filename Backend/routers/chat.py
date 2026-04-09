from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.finnhub_client import get_finnhub_quote, get_finnhub_profile, get_finnhub_metric
from services.ai100_client import (
    get_chat_response, simplify_for_eli5, improve_news_summary, generate_aggregated_summary, extract_ticker_with_ai, generate_stock_report
)
from services.news_processor import NewsProcessor
from services.prompt_router import classify_and_resolve_prompt
from typing import Optional
import datetime
import re
import json
import os

router = APIRouter()
news_processor = NewsProcessor()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    eli5: bool = False
    include_news: bool = False
    ticker: Optional[str] = None
    improve_summary: bool = False
    history: Optional[list[ChatMessage]] = None

# We use Finnhub Search API for dynamic ticker resolution instead of a local map.
from services.finnhub_client import get_finnhub_search

NEWS_KEYWORDS = (
    "news", "headlines", "headline", "latest", "update", "updates",
    "trend", "trends", "market recap", "top stories"
)

ELI5_KEYWORDS = (
    "eli5", "explain like i'm 5", "explain like i am 5",
    "explain simply", "simple terms", "for beginners"
)

async def extract_ticker(message: str):
    # 1. Check for explicit tickers in parentheses or as standalone uppercase words
    # This regex looks for words like (AAPL) or just AAPL
    explicit_matches = re.findall(r'\(?([A-Z]{2,5})\)?', message)
    common_words = {
        "WHAT", "HOW", "THE", "WHO", "WHY", "WHEN", "IS", "ARE", "DO", "DOES", "CAN", "WILL", "FOR", "AND", "BUT", "NEWS",
        "OUTLOOK", "GIVE", "TELL", "ME", "LATEST", "PRICE", "ABOUT", "QUOTES", "STOCK", "STOCKS", "HAPPENING",
        "HAPPENED", "TODAY", "YESTERDAY", "PERFORMING", "PERFORMANCE", "LOOKS", "LOOKING", "LIKE", "THIS", "THAT",
        "MARKET", "TREND", "TRENDS", "SECTOR", "INDUSTRY", "ECONOMY", "GENERAL", "ANY", "CURRENT", "INVEST", "INVESTING",
        "INVESTOR", "INVESTORS", "MONEY", "FINANCE", "FINANCIAL", "TRADE", "TRADING", "BUY", "SELL", "BUYING", "SELLING", "PORTFOLIO",
        "SUMMARIZE", "THEM", "THESE", "THOSE", "IT", "THEY", "HE", "SHE", "EXPLAIN", "MEAN", "SIMPLIFY", "MORE", "DETAIL",
        "DOING", "GOING", "COMPANY", "WORK", "WORKING", "RUNNING", "PERFORMING", "PERFORMANCE", "GOOD", "BAD", "GREAT"
    }
    
    message_upper = message.upper()
    general_phrases = ["MARKET NEWS", "MARKET TRENDS", "MARKET RECAP", "GENERAL MARKET", "HOW TO INVEST", "STOCK MARKET"]
    if any(phrase in message_upper for phrase in general_phrases):
        return None

    for t in explicit_matches:
        if t not in common_words:
            return t

    # 2. Extract potential keywords for search (e.g., "Apple", "Microsoft")
    # We'll look for capitalized words or phrases that aren't common words
    # and also include lowercase words if they are long enough and not common verbs
    words = re.findall(r'\b[A-Za-z]{3,}\b', message)
    potential_names = [w for w in words if w.upper() not in common_words]
    
    if potential_names:
        # Use Finnhub Search API for the most likely keyword (often the last noun)
        # We'll try just the last potential name first, then combined if that fails
        search_candidates = [potential_names[-1]] # Try the last one first
        if len(potential_names) > 1:
             search_candidates.append(" ".join(potential_names[-2:]))
        
        for search_query in search_candidates:
            try:
                search_results = get_finnhub_search(search_query)
                if search_results and "result" in search_results:
                    results = search_results["result"]
                    if results:
                        # Filter for US common stocks if possible, or just take the first match
                        for res in results:
                            ticker = res.get("symbol")
                            desc = res.get("description", "").upper()
                            # Try to avoid indices or non-US tickers if they have dots
                            if ticker and "." not in ticker:
                                # Additional check: if the query is in the description
                                if search_query.upper() in desc:
                                    return ticker
                        # If no exact match in description, return the first valid ticker
                        for res in results:
                            ticker = res.get("symbol")
                            if ticker and "." not in ticker:
                                return ticker
            except Exception as e:
                print(f"Finnhub search failed for '{search_query}': {e}")

    # 3. Handle cases like "news on AAPL" or "about AAPL"
    ticker_after_keyword = re.search(r'(?:on|about|for|to)\s+([A-Z]{2,5})', message, re.IGNORECASE)
    if ticker_after_keyword:
        t = ticker_after_keyword.group(1).upper()
        if t not in common_words:
            return t

    # 4. Fallback: Use AI to extract ticker
    return extract_ticker_with_ai(message)


def should_fetch_news(message: str, include_news: bool) -> bool:
    if include_news:
        return True
    lowered = message.lower()
    # Check for direct news keywords
    if any(keyword in lowered for keyword in NEWS_KEYWORDS):
        return True
    # Check for "what happened with [stock]", "updates on [stock]", etc.
    if re.search(r'what(?:\'s|\s+is)\s+happening|latest\s+on|updates?\s+on|news?\s+for', lowered):
        return True
    return False


def should_simplify(message: str, eli5: bool) -> bool:
    if eli5:
        return True
    lowered = message.lower()
    return any(keyword in lowered for keyword in ELI5_KEYWORDS)


def _format_number(value):
    if value is None:
        return "N/A"
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return str(value)


def _format_news_timestamp(epoch_seconds):
    if not epoch_seconds:
        return "Unknown time"
    try:
        dt = datetime.datetime.fromtimestamp(epoch_seconds)
        return dt.strftime("%b %d, %Y %I:%M %p")
    except Exception:
        return "Unknown time"


def _build_news_response(news_items, ticker: Optional[str], aggregated_summary: Optional[str] = None):
    ticker_label = ticker if ticker else "Market"
    header = f"### 📰 Latest {ticker_label} News & Insights"
    sections = [header, ""]

    if not news_items:
        return "I couldn't find any recent news articles for that query. Would you like me to try a general market search instead?"

    if aggregated_summary:
        sections.append(f"> **Summary:** {aggregated_summary}\n")

    for index, item in enumerate(news_items[:5], start=1):
        headline = item.get("headline", "Untitled article")
        source = item.get("source", "Unknown source")
        summary = item.get("summary", "Summary unavailable.")
        url = item.get("url")
        published = _format_news_timestamp(item.get("datetime"))
        sentiment = item.get("sentiment", "neutral").lower()
        
        sentiment_emoji = ""
        if "positive" in sentiment or "bullish" in sentiment:
            sentiment_emoji = "📈 "
        elif "negative" in sentiment or "bearish" in sentiment:
            sentiment_emoji = "📉 "
        
        sections.append(f"#### {index}. {sentiment_emoji}{headline}")
        sections.append(f"**Source:** {source} • *{published}*")
        if summary:
            # Remove stray headers that might trigger large fonts, and quote all lines
            cleaned = summary.strip().replace("###", "").replace("##", "").replace("#", "")
            formatted_summary = cleaned.replace('\n', '\n> ')
            sections.append(f"> {formatted_summary}")
        
        if url:
            sections.append(f"🔗 [Read full article]({url})")
        sections.append("---")

    return "\n".join(sections).strip().rstrip("---").strip()

def fetch_standard_stock_card_data(ticker: str):
    """Fetches standardized stock UI header data to keep frontend layout consistent."""
    try:
        quote = get_finnhub_quote(ticker)
        profile = get_finnhub_profile(ticker)
        metrics_data = get_finnhub_metric(ticker)
        metrics = metrics_data.get("metric", {})
        
        name = profile.get('name', ticker)
        price = quote.get('c')
        change = quote.get('d')
        percent = quote.get('dp')
        high = quote.get('h')
        low = quote.get('l')
        
        mcap = profile.get('marketCapitalization') or metrics.get('marketCapitalization', 0)
        if mcap > 1000:
            mcap_str = f"${mcap/1000:.2f}T"
        else:
            mcap_str = f"${mcap:.2f}B"

        industry = profile.get('finnhubIndustry', 'N/A')

        return {
            "name": name,
            "ticker": ticker,
            "price": price,
            "change": change,
            "percent": percent,
            "high": high,
            "low": low,
            "mcap": mcap_str,
            "industry": industry,
            "logo": profile.get("logo")
        }
    except Exception as e:
        print(f"Error fetching stock card data for {ticker}: {e}")
        return None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = [m.model_dump() if hasattr(m, 'model_dump') else m.dict() for m in request.history] if request.history else []
    
    # 1. Classify intent via the new AI Prompt Router
    resolution = classify_and_resolve_prompt(message, history)
    
    # 2. Merge frontend overrides with router outputs
    # If the user explicitly clicked the "news" button or asked for news, we honor it regardless of the classifier.
    intent = resolution.intent
    if request.include_news or should_fetch_news(message, request.include_news):
        intent = "FINANCIAL_NEWS"
        
    ticker = request.ticker or resolution.ticker
    
    # Check regular regex fallback if AI missed it (but skip for followups which have no explicit ticker)
    if not ticker and intent != "CONTEXTUAL_FOLLOWUP":
        ticker = await extract_ticker(message)
        
    eli5_mode = request.eli5 or should_simplify(message, False)

    stock_info = None
    if ticker:
        # Standardize the UI rendering for any valid stock
        stock_info = fetch_standard_stock_card_data(ticker)

    if intent == "FINANCIAL_NEWS":
        try:
            if ticker:
                to_date = datetime.date.today().isoformat()
                from_date = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
                news_items = news_processor.fetch_and_process_news(ticker=ticker, from_date=from_date, to_date=to_date)
            else:
                news_items = news_processor.fetch_and_process_news(ticker=None)

            if not news_items:
                ticker_label = f"for {ticker}" if ticker else ""
                fallback = f"I couldn't find fresh news {ticker_label} right now. Please try again in a minute."
                return {"response": fallback, "source": "finnhub_news", "ticker": ticker, "stock_data": stock_info}

            agg_summary = generate_aggregated_summary(news_items, ticker)
            response = _build_news_response(news_items, ticker, agg_summary)
            
            if request.improve_summary:
                response = improve_news_summary(response, ticker or "Market")
            if eli5_mode:
                response = simplify_for_eli5(response)

            return {"response": response, "source": "finnhub_news", "ticker": ticker, "stock_data": stock_info}
        except Exception as e:
            print(f"News summary fetch failed (ticker={ticker}): {e}")
            # fallback to generalized chat
            ai_response = get_chat_response(message, history=request.history)
            if eli5_mode:
                ai_response = simplify_for_eli5(ai_response)
            return {"response": ai_response, "source": "ai100", "stock_data": stock_info}

    elif intent == "LIVE_DATA_OVERVIEW" and ticker:
        try:
            quote = get_finnhub_quote(ticker)
            metrics_data = get_finnhub_metric(ticker)
            metrics = metrics_data.get("metric", {})

            try:
                to_date = datetime.date.today().isoformat()
                from_date = (datetime.date.today() - datetime.timedelta(days=14)).isoformat()
                news_items = news_processor.fetch_and_process_news(ticker=ticker, from_date=from_date, to_date=to_date)
            except Exception as news_err:
                print(f"Error fetching news for report: {news_err}")
                news_items = []

            name = stock_info.get("name") if stock_info else ticker
            ai_report = generate_stock_report(name, ticker, quote, metrics, news_items)

            if eli5_mode:
                ai_report = simplify_for_eli5(ai_report)
                
            return {
                "response": ai_report, 
                "source": "finnhub_report", 
                "ticker": ticker,
                "stock_data": stock_info
            }
        except Exception as e:
            print(f"Finnhub lookup failed for {ticker}: {e}")
            ai_response = get_chat_response(message, history=request.history)
            if eli5_mode:
                ai_response = simplify_for_eli5(ai_response)
            return {"response": ai_response, "source": "ai100", "stock_data": stock_info}

    elif intent == "CONTEXTUAL_FOLLOWUP" and resolution.contextual_reference:
        ai_prompt = f"Context from earlier conversation: {resolution.contextual_reference}\n\nUser asks: {message}"
        ai_response = get_chat_response(ai_prompt, history=None) # We embed the context directly
        if eli5_mode:
            ai_response = simplify_for_eli5(ai_response)
        return {"response": ai_response, "source": "ai100_context", "stock_data": stock_info}
        
    else:
        # Default AI chat for General EXPLANATION_ANALYSIS or fallback
        ai_response = get_chat_response(message, history=request.history)
        if eli5_mode:
            ai_response = simplify_for_eli5(ai_response)
        return {"response": ai_response, "source": "ai100", "stock_data": stock_info}
