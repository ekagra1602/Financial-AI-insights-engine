import hashlib
import datetime
from newspaper import Article
from services.finnhub_client import get_company_news
import nltk

# Download necessary NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

from services.ai100_client import analyze_text
from services.finnhub_client import get_company_news, get_market_news
from services.supabase_client import SupabaseClient

# ... (imports)

class NewsProcessor:
    def __init__(self):
        self.supabase = SupabaseClient()

    def fetch_and_process_news(self, ticker: str = None, from_date: str = None, to_date: str = None, force_refresh: bool = False):
        """
        Fetches news from Finnhub, dedupes, scrapes, and summarizes using AI100.
        Checks Supabase cache first unless force_refresh is True.
        """
        # 1. Try to get from Supabase first (Cache Hit) — skip if force_refresh
        if not force_refresh:
            try:
                db_news = self.supabase.get_recent_articles(ticker, limit=5, from_date=from_date)
                if db_news and len(db_news) > 0:
                    print(f"Cache HIT for ticker {ticker}: Found {len(db_news)} articles in DB.")
                    return db_news
            except Exception as e:
                print(f"Error checking DB cache: {e}")
        else:
            print(f"🔄 Force refresh requested for ticker {ticker} — skipping cache.")

        # 2. Cache Miss or insufficient data: Fetch from API
        print(f"Cache MISS for ticker {ticker}: Fetching from API...")
        try:
            if ticker:
                raw_news = get_company_news(ticker, from_date, to_date)
            else:
                raw_news = get_market_news("general")
        except Exception as e:
            print(f"Error fetching news (ticker={ticker}): {e}")
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
            
            # Check if this specific article is already in DB (to avoid re-processing)
            # Even though we checked DB for *any* articles above, we might have missed this specific one
            # if we are in a "partial cache" state or if we decided to re-fetch for some reason.
            # However, with the new logic, if we found ANY articles above, we returned.
            # So if we are here, it means we found NO articles in DB (or error).
            # So we probably don't need to check DB again for each article, 
            # UNLESS the DB check above failed or returned 0 but some articles actually exist 
            # (e.g. from_date mismatch).
            # But let's keep the check to be safe and avoid duplicates if we are backfilling.
            
            cached_article = self.supabase.get_article_by_hash(url_hash)
            if cached_article:
                # Cache Hit: Use stored data
                print(f"Article Cache HIT for {url}")
                processed_news.append(cached_article)
                continue
            
            print(f"Processing new article: {url}")

            # 3. Process and Store
            
            # Scrape content
            scraped_content = self._scrape_content(url)
            finnhub_summary = item.get('summary', '')
            
            # Validate scraped content — check for garbage responses
            # (JavaScript walls, cookie consent pages, error messages, etc.)
            content = self._pick_best_content(scraped_content, finnhub_summary, url)
            
            # Process with Qualcomm AI100
            ai_result = analyze_text(content)
            
            summary = ai_result.get('summary', '')
            if not summary:
                 summary = content[:300] + "..." if len(content) > 300 else content

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
                "ticker": ticker if ticker else "Market"
            }
            
            # Save to Supabase
            self.supabase.save_article(article_data)

            processed_news.append(article_data)
            
        return processed_news

    def _pick_best_content(self, scraped_content: str, finnhub_summary: str, url: str) -> str:
        """
        Decides which content to send to the AI100 for analysis.
        Detects garbage scraped content (JavaScript walls, cookie consent, error pages, etc.)
        and falls back to the Finnhub API summary when scraping fails.
        """
        # Indicators that the scraped content is garbage, not a real article
        GARBAGE_INDICATORS = [
            "enable javascript",
            "enable cookies",
            "javascript is disabled",
            "cookies are disabled",
            "please enable",
            "your browser",
            "ad blocker",
            "adblock",
            "subscribe to continue",
            "subscription required",
            "sign in to read",
            "log in to continue",
            "access denied",
            "403 forbidden",
            "404 not found",
            "page not found",
            "captcha",
            "are you a robot",
            "verify you are human",
            "consent to cookies",
            "cookie policy",
            "gdpr",
            "we use cookies",
            "accept cookies",
        ]

        MIN_ARTICLE_LENGTH = 100  # Minimum chars for a valid article

        # Check if scraped content exists and is usable
        if scraped_content and scraped_content.strip():
            content_lower = scraped_content.lower().strip()

            # Check for garbage indicators
            is_garbage = any(indicator in content_lower for indicator in GARBAGE_INDICATORS)

            # Check if content is too short to be a real article
            is_too_short = len(content_lower) < MIN_ARTICLE_LENGTH

            if is_garbage:
                print(f"   ⚠️  Scraped content is garbage (error/wall page), using Finnhub summary instead")
                print(f"   Garbage detected in: '{scraped_content[:80]}...'")
            elif is_too_short:
                print(f"   ⚠️  Scraped content too short ({len(content_lower)} chars), using Finnhub summary instead")
            else:
                # Scraped content looks good
                print(f"   📄 Using scraped content ({len(scraped_content)} chars)")
                return scraped_content
        else:
            print(f"   ⚠️  Scraping returned empty, using Finnhub summary")

        # Fallback to Finnhub summary
        if finnhub_summary and finnhub_summary.strip():
            print(f"   📄 Using Finnhub summary ({len(finnhub_summary)} chars)")
            return finnhub_summary

        # Last resort: use the URL itself as minimal context
        print(f"   ⚠️  No usable content for {url}")
        return f"News article from {url}"

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
