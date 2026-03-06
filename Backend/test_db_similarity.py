"""
============================================================
  TEST: Similar News Quality on Real DB Articles
============================================================

Tests how well our embedding-based similar news search works
on the actual articles stored in Supabase.

For each article in the DB, finds its top similar matches and
reports whether they are cross-company topic matches or just
same-company matches.

Run:  python test_db_similarity.py
============================================================
"""

import os
import sys
import numpy as np
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from services.supabase_client import SupabaseClient
from services.embeddings import get_embedding


def cosine_similarity(vec_a, vec_b):
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def fetch_all_articles_with_embeddings(supabase: SupabaseClient):
    """Fetch all articles that have embeddings from the DB."""
    if not supabase.client:
        return []
    try:
        response = (
            supabase.client.table("news_articles")
            .select("url_hash, headline, summary, ticker, source, datetime, sentiment, keywords, embedding")
            .not_.is_("embedding", "null")
            .order("datetime", desc=True)
            .limit(200)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Error fetching articles: {e}")
        return []


def main():
    print("=" * 70)
    print("  TEST: Similar News Search Quality on Real DB Articles")
    print("=" * 70)

    supabase = SupabaseClient()
    if not supabase.client:
        print("Error: Could not connect to Supabase. Check your .env file.")
        return

    # ─── Fetch all articles with embeddings ───────────────────────
    print("\nFetching articles from database...")
    articles = fetch_all_articles_with_embeddings(supabase)

    if not articles:
        print("No articles with embeddings found. Run the app to fetch some news first.")
        return

    # Filter articles that actually have valid embeddings
    valid_articles = []
    for a in articles:
        emb = a.get("embedding")
        if emb and isinstance(emb, (list, str)):
            if isinstance(emb, str):
                # pgvector sometimes returns as string — parse it
                try:
                    emb = [float(x) for x in emb.strip("[]").split(",")]
                    a["embedding"] = emb
                except Exception:
                    continue
            valid_articles.append(a)

    print(f"Found {len(valid_articles)} articles with valid embeddings.\n")

    if len(valid_articles) < 3:
        print("Need at least 3 articles to test similarity. Fetch more news first.")
        return

    # ─── Overview: Articles by ticker ─────────────────────────────
    ticker_counts = defaultdict(int)
    for a in valid_articles:
        ticker_counts[a.get("ticker", "?")] += 1

    print("Articles by ticker:")
    for ticker, count in sorted(ticker_counts.items(), key=lambda x: -x[1]):
        print(f"  {ticker:>10s}: {count} articles")
    print()

    # ─── Test 1: Similar search via pgvector RPC ──────────────────
    print("=" * 70)
    print("  TEST 1: pgvector Similar Search (what the app actually uses)")
    print("=" * 70)

    # Pick up to 5 articles from different tickers as test sources
    seen_tickers = set()
    test_sources = []
    for a in valid_articles:
        t = a.get("ticker", "?")
        if t not in seen_tickers:
            seen_tickers.add(t)
            test_sources.append(a)
        if len(test_sources) >= 5:
            break

    for source in test_sources:
        source_ticker = source.get("ticker", "?")
        source_headline = source.get("headline", "")
        source_hash = source.get("url_hash", "")

        print(f"\n{'─' * 70}")
        print(f"SOURCE [{source_ticker}]: {source_headline}")
        print(f"{'─' * 70}")

        # Use the RPC function (same as the app)
        results = supabase.search_similar_articles(
            query_embedding=source["embedding"],
            match_threshold=0.5,
            match_count=6
        )

        if not results:
            print("  No similar articles found (threshold: 0.5)")
            continue

        # Filter out self
        results = [r for r in results if r.get("url_hash") != source_hash]

        if not results:
            print("  No similar articles found (only self matched)")
            continue

        same_ticker = 0
        diff_ticker = 0

        for i, r in enumerate(results[:5], 1):
            r_ticker = r.get("ticker", "?")
            sim = r.get("similarity", 0)
            r_headline = r.get("headline", "")

            is_same = r_ticker == source_ticker
            if is_same:
                same_ticker += 1
                marker = "(same company)"
            else:
                diff_ticker += 1
                marker = "(CROSS-COMPANY)"

            bar = "#" * int(sim * 30)
            print(f"  {i}. [{r_ticker:>8s}] {sim:.4f} {bar}")
            print(f"     {r_headline[:65]}")
            print(f"     {marker}")

        print(f"\n  Summary: {same_ticker} same-company, {diff_ticker} cross-company matches")

    # ─── Test 2: Local cosine similarity (full comparison) ────────
    print(f"\n{'=' * 70}")
    print("  TEST 2: Full Pairwise Similarity (local cosine, top pairs)")
    print("=" * 70)

    # Compute similarity for all pairs (skip self)
    all_pairs = []
    for i, a1 in enumerate(valid_articles):
        for j, a2 in enumerate(valid_articles):
            if i >= j:
                continue
            sim = cosine_similarity(a1["embedding"], a2["embedding"])
            all_pairs.append((a1, a2, sim))

    all_pairs.sort(key=lambda x: x[2], reverse=True)

    print(f"\nComputed {len(all_pairs)} pairwise similarities.\n")

    # Top 10 most similar pairs
    print("Top 10 Most Similar Article Pairs:")
    print("-" * 70)
    cross_in_top = 0
    for i, (a1, a2, sim) in enumerate(all_pairs[:10], 1):
        t1 = a1.get("ticker", "?")
        t2 = a2.get("ticker", "?")
        h1 = a1.get("headline", "")[:50]
        h2 = a2.get("headline", "")[:50]
        is_cross = t1 != t2
        if is_cross:
            cross_in_top += 1
        tag = "CROSS-COMPANY" if is_cross else "same company"

        print(f"  {i:>2}. Similarity: {sim:.4f}  ({tag})")
        print(f"      [{t1:>8s}] {h1}")
        print(f"      [{t2:>8s}] {h2}")
        print()

    # ─── Test 3: Stats ────────────────────────────────────────────
    print("=" * 70)
    print("  TEST 3: Overall Statistics")
    print("=" * 70)

    sims = [s for _, _, s in all_pairs]
    cross_sims = [s for a1, a2, s in all_pairs if a1.get("ticker") != a2.get("ticker")]
    same_sims = [s for a1, a2, s in all_pairs if a1.get("ticker") == a2.get("ticker")]

    print(f"\n  Total article pairs:         {len(all_pairs)}")
    print(f"  Cross-company pairs:         {len(cross_sims)}")
    print(f"  Same-company pairs:          {len(same_sims)}")

    print(f"\n  All pairs:")
    print(f"    Average similarity:        {np.mean(sims):.4f}")
    print(f"    Max similarity:            {np.max(sims):.4f}")
    print(f"    Min similarity:            {np.min(sims):.4f}")

    if cross_sims:
        print(f"\n  Cross-company pairs:")
        print(f"    Average similarity:        {np.mean(cross_sims):.4f}")
        print(f"    Max similarity:            {np.max(cross_sims):.4f}")

    if same_sims:
        print(f"\n  Same-company pairs:")
        print(f"    Average similarity:        {np.mean(same_sims):.4f}")
        print(f"    Max similarity:            {np.max(same_sims):.4f}")

    # Quality check
    print(f"\n  Cross-company matches in top 10 pairs: {cross_in_top}/10")

    if cross_in_top >= 3:
        print("  -> GOOD: Embeddings are finding cross-company topic matches.")
    elif cross_in_top >= 1:
        print("  -> OK: Some cross-company matches, but mostly same-company bias.")
        print("     This may improve as more articles from different tickers are added.")
    else:
        print("  -> WARNING: All top matches are same-company.")
        print("     Check if embeddings still include ticker/company name in the text.")

    # ─── Similarity distribution ──────────────────────────────────
    print(f"\n  Similarity Distribution:")
    ranges = [(0.9, 1.0), (0.8, 0.9), (0.7, 0.8), (0.6, 0.7), (0.5, 0.6), (0.0, 0.5)]
    for lo, hi in ranges:
        count = sum(1 for s in sims if lo <= s < hi)
        bar = "#" * (count * 2) if count < 30 else "#" * 60 + f" ({count})"
        label = f"  {lo:.1f}-{hi:.1f}"
        print(f"    {label}: {bar} ({count})")

    print()


if __name__ == "__main__":
    main()
