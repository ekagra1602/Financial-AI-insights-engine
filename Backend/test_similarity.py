import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to sys.path so we can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.supabase_client import SupabaseClient

def main():
    print("Initializing Supabase client...")
    supabase = SupabaseClient()
    
    if not supabase.client:
        print("Error: Could not initialize Supabase client. Check your .env file.")
        return

    print("Fetching recent articles from the database to test similarity...")
    # Fetch a few recent articles to use as a query
    recent_articles = supabase.get_recent_articles(limit=10)
    
    if not recent_articles:
        print("No articles found in the database. Please run your app and let it fetch/process some news first.")
        return

    print(f"\nFound {len(recent_articles)} articles.\n")
    
    # Pick the first article as our target
    target_article = recent_articles[0]
    target_hash = target_article.get("url_hash")
    target_headline = target_article.get("headline")
    target_ticker = target_article.get("ticker", "Unknown")
    target_embedding = target_article.get("embedding")
    
    print("=" * 60)
    print(f"🎯 TARGET ARTICLE [{target_ticker}]:")
    print(f"Headline: {target_headline}")
    print(f"Summary: {target_article.get('summary', '')[:150]}...")
    print("=" * 60)
    
    if not target_embedding:
        print("\nError: The target article has no embedding in the database.")
        print("Make sure your articles were processed after the dimension update.")
        return
        
    if isinstance(target_embedding, str):
        # Depending on how the python client parses the pgvector, it might be a string like '[0.1, 0.2, ...]'
        # But usually supabase-py returns it as a list if we query it directly. Let's assume the RPC handles it.
        pass

    print("\n🔍 Running similarity search in Supabase (comparing vectors)...")
    
    # We ask for top 6, because the #1 result will be the target article itself (similarity ~1.0)
    match_count = 6
    threshold = 0.1 # Very low threshold just to see what comes back
    
    try:
        similar_articles = supabase.search_similar_articles(
            query_embedding=target_embedding,
            match_threshold=threshold,
            match_count=match_count
        )
        
        if not similar_articles:
            print("No similar articles found matching the threshold.")
            return
            
        print(f"\nFound {len(similar_articles)} results (including the original):")
        print("-" * 60)
        
        for idx, article in enumerate(similar_articles):
            # Skip the target article itself if it has a similarity of ~1.0
            is_target = article.get("url_hash") == target_hash
            prefix = "👉 (TARGET)" if is_target else f"#{idx}"
            
            similarity = article.get("similarity", 0)
            ticker = article.get("ticker", "Unknown")
            headline = article.get("headline", "No Headline")
            
            print(f"{prefix} [{ticker}] Score: {similarity:.4f}")
            print(f"   Headline: {headline}")
            if not is_target:
                print(f"   Summary: {article.get('summary', '')[:100]}...")
            print("-" * 60)
            
    except Exception as e:
        print(f"\n❌ Error running similarity search: {e}")
        print("\nDid you remember to run the updated vector_setup.sql in your Supabase SQL Editor?")
        print("The database needs to be configured for 768 dimensions.")

if __name__ == "__main__":
    main()
