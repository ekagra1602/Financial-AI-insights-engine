"""9 behavioral non-regression tests for the news feature."""
import pytest
from unittest.mock import patch, MagicMock


MOCK_ARTICLE = {
    "url": "https://example.com/article",
    "url_hash": "abc123",
    "headline": "Apple reports record revenue",
    "summary": "Apple Inc. reported record revenue in Q1.",
    "datetime": 1745452800,
    "sentiment": "positive",
    "tone": "optimistic",
    "keywords": ["AAPL", "revenue"],
    "ticker": "AAPL",
}


class TestNewsRegression:

    def test_company_news_returns_list(self, client):
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.fetch_and_process_news.return_value = [MOCK_ARTICLE]
            resp = client.get("/api/v1/news/AAPL")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_company_news_articles_have_required_fields(self, client):
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.fetch_and_process_news.return_value = [MOCK_ARTICLE]
            resp = client.get("/api/v1/news/AAPL")
        articles = resp.json()
        assert len(articles) == 1
        for field in ("headline", "url", "datetime", "sentiment"):
            assert field in articles[0], f"Missing field: {field}"

    def test_market_news_returns_list(self, client):
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.fetch_and_process_news.return_value = [MOCK_ARTICLE]
            resp = client.get("/api/v1/news")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_similar_news_returns_list_for_known_hash(self, client):
        from unittest.mock import AsyncMock
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.get_similar_articles = AsyncMock(return_value=[
                {**MOCK_ARTICLE, "similarity": 0.92},
            ])
            resp = client.get("/api/v1/news/similar/abc123")
        assert resp.status_code == 200
        result = resp.json()
        assert isinstance(result, list)

    def test_similar_news_unknown_hash_does_not_crash(self, client):
        from unittest.mock import AsyncMock
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.get_similar_articles = AsyncMock(return_value=[])
            resp = client.get("/api/v1/news/similar/BADHASH999")
        # Either 200 empty list or 404 — never 500
        assert resp.status_code in (200, 404)

    def test_news_briefing_toggle_on(self, client):
        """POST /news-briefing/toggle/{symbol} enables briefing for a symbol."""
        with patch("routers.news_briefing.update_news_notify_count"), \
             patch("routers.news_briefing._generate_briefing_for_symbol", return_value=None):
            resp = client.post("/api/v1/news-briefing/toggle/AAPL", json={"enabled": True})
        assert resp.status_code in (200, 201)

    def test_news_briefing_toggle_off(self, client):
        """POST /news-briefing/toggle/{symbol} disables briefing for a symbol."""
        with patch("routers.news_briefing.update_news_notify_count"):
            resp = client.post("/api/v1/news-briefing/toggle/AAPL", json={"enabled": False})
        assert resp.status_code in (200, 201)

    def test_ticker_search_returns_results(self, client):
        """GET /api/v1/search?q=Apple → list of results with symbol and description."""
        with patch("services.finnhub_client.get_finnhub_search") as mock_search:
            mock_search.return_value = {
                "result": [
                    {"symbol": "AAPL", "description": "Apple Inc.", "type": "Common Stock"},
                ]
            }
            resp = client.get("/api/v1/search?q=Apple")
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("result", [])
        assert len(items) >= 1

    def test_news_processor_exception_returns_500(self, client):
        with patch("routers.news.news_processor") as mock_proc:
            mock_proc.fetch_and_process_news.side_effect = RuntimeError("Scraper failed")
            resp = client.get("/api/v1/news/AAPL")
        assert resp.status_code == 500
