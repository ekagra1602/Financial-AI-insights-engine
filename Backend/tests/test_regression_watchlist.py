"""7 behavioral non-regression tests for the watchlist feature."""
import pytest
from unittest.mock import patch, MagicMock


class TestWatchlistRegression:

    def test_get_watchlist_returns_list(self, client):
        with patch("routers.watchlist.get_watchlist", return_value=[]), \
             patch("routers.watchlist.get_finnhub_quote", return_value={"c": 150, "dp": 1.5}):
            resp = client.get("/api/v1/watchlist")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_add_ticker_to_watchlist(self, client):
        with patch("routers.watchlist.add_to_watchlist") as mock_add, \
             patch("routers.watchlist.get_finnhub_quote", return_value={"c": 150, "dp": 1.5}):
            resp = client.post("/api/v1/watchlist", json={"symbol": "MSFT", "name": "Microsoft"})
        assert resp.status_code == 200
        mock_add.assert_called_once_with("MSFT", "Microsoft")

    def test_duplicate_add_does_not_crash(self, client):
        """Posting the same ticker twice must not raise an error."""
        with patch("routers.watchlist.add_to_watchlist"):
            client.post("/api/v1/watchlist", json={"symbol": "AAPL", "name": "Apple"})
            resp = client.post("/api/v1/watchlist", json={"symbol": "AAPL", "name": "Apple"})
        assert resp.status_code == 200

    def test_remove_ticker_from_watchlist(self, client):
        with patch("routers.watchlist.remove_from_watchlist") as mock_del:
            resp = client.delete("/api/v1/watchlist/MSFT")
        assert resp.status_code == 200
        mock_del.assert_called_once_with("MSFT")

    def test_watchlist_enriched_with_price(self, client):
        """GET /watchlist enriches each item with 'price' from Finnhub."""
        mock_items = [{"symbol": "AAPL", "name": "Apple", "news_notify_count": 0}]
        with patch("routers.watchlist.get_watchlist", return_value=mock_items), \
             patch("routers.watchlist.get_finnhub_quote", return_value={"c": 185.5, "dp": 0.8}):
            resp = client.get("/api/v1/watchlist")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["price"] == 185.5

    def test_watchlist_price_none_when_finnhub_fails(self, client):
        """Finnhub error → price=None, response still 200."""
        mock_items = [{"symbol": "AAPL", "name": "Apple", "news_notify_count": 0}]
        with patch("routers.watchlist.get_watchlist", return_value=mock_items), \
             patch("routers.watchlist.get_finnhub_quote", side_effect=Exception("timeout")):
            resp = client.get("/api/v1/watchlist")
        assert resp.status_code == 200
        assert resp.json()[0]["price"] is None

    def test_empty_watchlist_returns_empty_list(self, client):
        with patch("routers.watchlist.get_watchlist", return_value=[]):
            resp = client.get("/api/v1/watchlist")
        assert resp.status_code == 200
        assert resp.json() == []
