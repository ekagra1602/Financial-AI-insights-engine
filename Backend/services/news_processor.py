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

# ... (imports)

class NewsProcessor:
    def __init__(self):
        # In-memory deduplication storage (hash set)
        self.seen_urls = set()

    def fetch_and_process_news(self, ticker: str = None, from_date: str = None, to_date: str = None):
        """
        Fetches news from Finnhub, dedupes, scrapes, and summarizes using AI100.
        If ticker is provided, fetches company news.
        If ticker is None, fetches general market news.
        Returns top 5 processed news items.
        """
        try:
            if ticker:
                raw_news = get_company_news(ticker, from_date, to_date)
            else:
                # Fetch general market news
                raw_news = get_market_news("general")
        except Exception as e:
            print(f"Error fetching news (ticker={ticker}): {e}")
            return []

        processed_news = []
        
        # Sort by datetime desc just in case
        raw_news.sort(key=lambda x: x.get('datetime', 0), reverse=True)

        for item in raw_news:
            if len(processed_news) >= 5:
                break

            url = item.get('url')
            if not url:
                continue
                
            # Deduplicate
            url_hash = self._hash_url(url)
            if url_hash in self.seen_urls:
                continue
            self.seen_urls.add(url_hash)
            
            # Scrape content
            content = self._scrape_content(url)
            
            # Fallback to Finnhub summary if scraping fails or returns empty
            if not content:
                content = item.get('summary', '')
            
            # Process with Qualcomm AI100
            # We send the content to the LLM for summarization
            ai_result = analyze_text(content)
            
            # The user requested only summaries, but we store the full analysis result
            # The frontend can choose what to display.
            # We ensure 'summary' is present.
            summary = ai_result.get('summary', '')
            if not summary:
                 # Fallback if AI100 returns empty summary
                 summary = content[:300] + "..." if len(content) > 300 else content

            processed_news.append({
                "headline": item.get('headline'),
                "source": item.get('source'),
                "url": url,
                "datetime": item.get('datetime'),
                "summary": summary,
                "sentiment": ai_result.get('sentiment', 'neutral'),
                "tone": ai_result.get('tone', 'neutral'),
                "keywords": ai_result.get('keywords', [])
            })
            
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
            article = Article(url)
            article.download()
            article.parse()
            return article.text
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None
