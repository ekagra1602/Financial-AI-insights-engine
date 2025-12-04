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

    def fetch_and_process_news(self, ticker: str = None, from_date: str = None, to_date: str = None):
        """
        Fetches news from Finnhub, dedupes, scrapes, and summarizes using AI100.
        Checks Supabase cache first.
        """
        # 1. Try to get from Supabase first (Cache Hit)
        # Note: This assumes we have a way to know if we have "fresh" news. 
        # For simplicity, we will fetch from API to get latest URLs, but only process/summarize if not in DB.
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
            
            # 2. Check Supabase (Persistent Cache)
            cached_article = self.supabase.get_article_by_hash(url_hash)
            if cached_article:
                # Cache Hit: Use stored data
                print(f"Cache HIT for {url}")
                processed_news.append({
                    "headline": cached_article.get('headline'),
                    "source": cached_article.get('source'),
                    "url": cached_article.get('url'),
                    "datetime": cached_article.get('datetime'),
                    "summary": cached_article.get('summary'),
                    "sentiment": cached_article.get('sentiment'),
                    "tone": cached_article.get('tone'),
                    "keywords": cached_article.get('keywords', [])
                })
                continue
            
            print(f"Cache MISS for {url}")

            # 3. Cache Miss: Process and Store
            
            # Scrape content
            content = self._scrape_content(url)
            
            # Fallback to Finnhub summary if scraping fails or returns empty
            if not content:
                content = item.get('summary', '')
            
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

    def _hash_url(self, url: str) -> str:
        """
        Standardizes URL and returns SHA256 hash.
        """
        # Lowercase and remove query parameters for basic canonicalization
        clean_url = url.lower().split('?')[0]
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
