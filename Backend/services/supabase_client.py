import os
from supabase import create_client, Client
from typing import Optional, Dict, Any
import datetime

class SupabaseClient:
    def __init__(self):
        self.url: str = os.getenv("SUPABASE_URL")
        self.key: str = os.getenv("SUPABASE_KEY")
        self.client: Optional[Client] = None
        
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
            except Exception as e:
                print(f"Failed to initialize Supabase client: {e}")
        else:
            print("Warning: SUPABASE_URL or SUPABASE_KEY not set.")

    def get_article_by_hash(self, url_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve an article by its URL hash.
        """
        if not self.client:
            return None
            
        try:
            response = self.client.table("news_articles").select("*").eq("url_hash", url_hash).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error fetching article from Supabase: {e}")
            return None

    def save_article(self, article_data: Dict[str, Any]):
        """
        Save a processed article to Supabase.
        """
        if not self.client:
            return
            
        try:
            # Ensure we don't insert duplicates if they already exist (though check should happen before)
            # Upsert is safer
            self.client.table("news_articles").upsert(article_data, on_conflict="url_hash").execute()
        except Exception as e:
            print(f"Error saving article to Supabase: {e}")

    def get_recent_articles(self, ticker: str, limit: int = 5) -> list:
        """
        Get recent articles for a ticker from DB.
        """
        if not self.client:
            return []
            
        try:
            # If ticker is 'Market' or None, we might want general news
            query = self.client.table("news_articles").select("*").order("datetime", desc=True).limit(limit)
            
            if ticker and ticker != "Market":
                # We need to filter by ticker. 
                # Since our schema might store keywords or we might add a ticker column.
                # For now, let's assume we add a 'ticker' column or filter by keywords containing ticker.
                # Simpler: add 'ticker' column to the table.
                query = query.eq("ticker", ticker)
                
            response = query.execute()
            return response.data
        except Exception as e:
            print(f"Error fetching recent articles from Supabase: {e}")
            return []
