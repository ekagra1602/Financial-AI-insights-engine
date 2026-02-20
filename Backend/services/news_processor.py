import hashlib
import datetime
import json
import os
import re
from newspaper import Article
from services.finnhub_client import get_company_news, get_finnhub_profile
import nltk

# Download necessary NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

from services.ai100_client import analyze_text
from services.embeddings import get_embedding
from services.finnhub_client import get_company_news, get_market_news, get_finnhub_profile
from services.supabase_client import SupabaseClient

# ... (imports)

class NewsProcessor:
    def __init__(self):
        self.supabase = SupabaseClient()
        self.company_name_cache = {}  # In-memory cache: ticker -> company name

    def fetch_and_process_news(self, ticker: str = None, from_date: str = None, to_date: str = None, force_refresh: bool = False):
        """
        Fetches news from Finnhub, dedupes, scrapes, and summarizes using AI100.
        Checks Supabase cache first (unless force_refresh is True).
        """
        # --- STRATEGY: Prioritize Freshness (Today) ---
        
        # 1. Determine "Today" (approximate, based on server time or UTC)
        # We want to check if we have enough articles from last 24 hours first.
        today_date = datetime.date.today().isoformat()
        yesterday_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        
        # If user explicitly asked for a range that is NOT just "recent", respect it.
        # But usually from_date defaults to 7 days ago. We want to tighten that default check.
        
        # Check DB for VERY RECENT news (last 24 hours) first — skip if force_refresh
        if not force_refresh:
            try:
                # Check for articles from yesterday onwards (last ~24-48h window)
                fresh_news = self.supabase.get_recent_articles(ticker, limit=5, from_date=yesterday_date)
                if fresh_news and len(fresh_news) >= 5:
                    # Only return cache if we have the full 5 articles
                    print(f"Fresh Cache HIT for ticker {ticker}: Found {len(fresh_news)} recent articles.")
                    return fresh_news
            except Exception as e:
                print(f"Error checking DB fresh cache: {e}")
        else:
            print(f"🔄 Force refresh requested for ticker {ticker} — skipping cache")


        # 2. Cache Miss (or not enough fresh news): Fetch from API
        # We only fetch if we don't have enough fresh data.
        print(f"Fresh Cache MISS for ticker {ticker}: Fetching from API...")
        try:
            if ticker:
                # Ask API specifically for recent news (e.g., last 3 days to catch up)
                # Ensure we don't ask for too old data if we want freshness
                api_from = yesterday_date if not from_date else from_date 
                raw_news = get_company_news(ticker, api_from, to_date)
            else:
                raw_news = get_market_news("general")
        except Exception as e:
            print(f"Error fetching news (ticker={ticker}): {e}")
            # If API fails, try to fallback to ANY cache (even if older than yesterday)
            try:
                 # Fallback: Get whatever we have in DB for the requested period (last 7 days default)
                fallback_limit = 5
                fallback_news = self.supabase.get_recent_articles(ticker, limit=fallback_limit, from_date=from_date)
                if fallback_news:
                     print(f"API Failed, returning older cached news for {ticker}")
                     return fallback_news
            except Exception as inner_e:
                print(f"Fallback cache failed: {inner_e}")
            return []

        processed_news = []
        seen_urls = set()
        
        # Sort by datetime desc
        raw_news.sort(key=lambda x: x.get('datetime', 0), reverse=True)

        # Try to process up to 5 articles to ensure we get at least some valid ones
        for item in raw_news:
            if len(processed_news) >= 5:
                break

            url = item.get('url')
            if not url:
                continue
                
            # Deduplicate in-memory for this request
            url_hash = self._hash_url(url)
            if url_hash in seen_urls:
                continue
            seen_urls.add(url_hash)
            
            cached_article = self.supabase.get_article_by_hash(url_hash)
            if cached_article:
                # Cache Hit: Use stored data
                print(f"Article Cache HIT for {url}")
                processed_news.append(cached_article)
                continue
            
            print(f"Processing new article: {url}")

            # 3. Process and Store
            
            # Scrape content
            content = self._scrape_content(url)
            
            # Fallback to Finnhub summary if scraping fails or returns empty
            if not content:
                content = item.get('summary', '')
            
            # Process with Qualcomm AI100
            ai_result = analyze_text(content)
            
            # If AI100 failed, skip this article and try the next one
            if ai_result is None:
                print(f"⏭️ [AI100] Skipping article (AI100 failed): {item.get('headline', url)}")
                continue
            
            summary = ai_result.get('summary', '')
            if not summary:
                print(f"⏭️ [AI100] Skipping article (empty summary): {item.get('headline', url)}")
                continue

            # Check Relevance (Post-processing)
            # If ticker is specified, we ONLY want to save/return if it's relevant.
            final_ticker = "Market"
            is_relevant = True
            headline = item.get('headline', '')
            keywords = ai_result.get('keywords', [])
            company_name = ''

            if ticker:
                final_ticker = ticker
                company_name = self._get_company_name(ticker)
                
                if self._is_relevant(ticker, company_name, summary, keywords, headline):
                    final_ticker = ticker
                else:
                    is_relevant = False
                    print(f"Skipping irrelevant article for {ticker}: {headline}. Storing as 'Market'.")
                    final_ticker = "Market" # Still save it, but associated with general Market
            else:
                final_ticker = "Market"

            # Generate vector embedding for similarity search
            # Enrich with ticker, company name, and keywords so related entities
            # (e.g. "Meta" and "Zuckerberg") cluster closer in vector space
            text_to_embed = f"{final_ticker} {company_name} {headline} {summary} {' '.join(keywords)}"
            embedding = get_embedding(text_to_embed)

            article_data = {
                "url_hash": url_hash,
                "headline": item.get('headline'),
                "source": item.get('source'),
                "url": url,
                "datetime": item.get('datetime'),
                "summary": summary,
                "sentiment": ai_result.get('sentiment', 'neutral'),
                "tone": ai_result.get('tone', 'neutral'),
                "keywords": ai_result.get('keywords', []),
                "ticker": final_ticker,
                "embedding": embedding 
            }
            
            # Save to Supabase
            self.supabase.save_article(article_data)

            # Only add to returned list if it was relevant to the requested ticker
            if is_relevant:
                processed_news.append(article_data)
            
        return processed_news

    def _get_company_name(self, ticker: str) -> str:
        """
        Gets the company name for a ticker via Finnhub profile API.
        Caches results in-memory to avoid repeated API calls.
        """
        if ticker in self.company_name_cache:
            return self.company_name_cache[ticker]
        
        try:
            profile = get_finnhub_profile(ticker)
            name = profile.get('name', '')
            self.company_name_cache[ticker] = name
            return name
        except Exception as e:
            print(f"Error fetching company name for {ticker}: {e}")
            self.company_name_cache[ticker] = ''  # Cache empty to avoid repeated failures
            return ''

    def _is_relevant(self, ticker, company_name, summary, keywords, headline):
        """
        Checks if the article is relevant to the ticker/company.
        """
        if not ticker or ticker == "Market":
            return True
            
        ticker_upper = ticker.upper()
        
        # Prepare search terms
        search_terms = {ticker_upper}
        
        if company_name:
            # Clean company name: Remove Inc, Corp, Ltd, etc.
            import re
            clean_name = re.sub(r'(?i)\s+(inc\.?|corp\.?|co\.?|ltd\.?|plc|group|holdings|technologies|solutions)\b.*', '', company_name)
            clean_name = clean_name.strip()
            if len(clean_name) > 2: # Avoid tiny names
                search_terms.add(clean_name.upper())
        
        # Check Keywords (Strong signal)
        keyword_match = any(term in k.upper() for k in keywords for term in search_terms)
        if keyword_match:
            return True
            
        # Check Headline (Strong signal)
        headline_upper = headline.upper()
        headline_match = any(term in headline_upper for term in search_terms)
        if headline_match:
            return True
            
        # Check Summary (Medium signal)
        # We want strict matching in summary to avoid casual mentions.
        # But for now, let's trust if it appears.
        summary_upper = summary.upper()
        summary_match = any(term in summary_upper for term in search_terms)
        
        return summary_match


    def _hash_url(self, url: str) -> str:
        """
        Standardizes URL and returns SHA256 hash.
        """
        # Lowercase but KEEP query parameters as they are essential for some URLs (e.g. Finnhub IDs)
        clean_url = url.lower().strip()
        return hashlib.sha256(clean_url.encode('utf-8')).hexdigest()

    def _scrape_content(self, url: str) -> str:
        """
        Uses newspaper3k to scrape article text.
        """
        try:
            # Set a timeout for download
            from newspaper import Config
            config = Config()
            config.browser_user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            config.request_timeout = 10

            article = Article(url, config=config)
            article.download()
            article.parse()
            return article.text
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None
