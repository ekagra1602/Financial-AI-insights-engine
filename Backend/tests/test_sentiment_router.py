"""
12 tests covering 3 sentiment router endpoints:
  GET  /api/v1/sentiment/report/{ticker}    (7 tests)
  POST /api/v1/sentiment/ingest/{ticker}    (3 tests)
  GET  /api/v1/sentiment/llm-input/{ticker} (2 tests)
"""
import pytest
from unittest.mock import patch


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/sentiment/report/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestGetSentimentReport:

    def test_cache_miss_triggers_generation(self, client, sample_report):
        """Cache miss → engine runs and returns full 7-key report."""
        with patch("routers.sentiment.sentiment_engine") as eng:
            eng.generate_report.return_value = sample_report
            resp = client.get("/api/v1/sentiment/report/AAPL?horizon=1M")
        assert resp.status_code == 200
        data = resp.json()
        for key in ("ticker", "companyName", "horizon", "generatedAt", "forecast", "risk", "narrative"):
            assert key in data, f"Missing key: {key}"
        assert data["ticker"] == "AAPL"
        assert data["horizon"] == "1M"

    def test_generate_report_called_with_correct_args(self, client, sample_report):
        """Engine is called with the uppercased ticker, horizon, and force_refresh=False."""
        with patch("routers.sentiment.sentiment_engine") as eng:
            eng.generate_report.return_value = sample_report
            client.get("/api/v1/sentiment/report/aapl?horizon=1W")
        eng.generate_report.assert_called_once_with("AAPL", "1W", False)

    def test_force_refresh_passes_true_to_engine(self, client, sample_report):
        """force_refresh=true query param → engine called with force_refresh=True."""
        with patch("routers.sentiment.sentiment_engine") as eng:
            eng.generate_report.return_value = sample_report
            client.get("/api/v1/sentiment/report/AAPL?force_refresh=true")
        _, _, force = eng.generate_report.call_args[0]
        assert force is True

    def test_invalid_horizon_returns_400(self, client):
        """Unknown horizon value → 400 (router raises HTTPException explicitly)."""
        with patch("routers.sentiment.sentiment_engine"):
            resp = client.get("/api/v1/sentiment/report/AAPL?horizon=5Y")
        assert resp.status_code == 400

    @pytest.mark.parametrize("horizon", ["1D", "1W", "1M", "3M", "6M"])
    def test_all_valid_horizons_return_200(self, client, sample_report, horizon):
        """Each of the 5 valid horizon values returns 200 and echoes the horizon."""
        with patch("routers.sentiment.sentiment_engine") as eng:
            report = {**sample_report, "horizon": horizon}
            eng.generate_report.return_value = report
            resp = client.get(f"/api/v1/sentiment/report/AAPL?horizon={horizon}")
        assert resp.status_code == 200
        assert resp.json()["horizon"] == horizon

    def test_engine_value_error_returns_404(self, client):
        """ValueError from engine (no financial data) → 404."""
        with patch("routers.sentiment.sentiment_engine") as eng:
            eng.generate_report.side_effect = ValueError("No financial data for ZZZZ")
            resp = client.get("/api/v1/sentiment/report/ZZZZ")
        assert resp.status_code == 404

    def test_engine_exception_returns_500(self, fresh_db):
        """Unexpected engine exception → 500 (uses raise_server_exceptions=False to see response)."""
        from fastapi.testclient import TestClient
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            with patch("routers.sentiment.sentiment_engine") as eng:
                eng.generate_report.side_effect = RuntimeError("unexpected")
                resp = c.get("/api/v1/sentiment/report/AAPL")
        assert resp.status_code == 500


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/sentiment/ingest/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestIngestEndpoint:

    def test_ingest_returns_ticker_and_status_ok(self, client):
        """Successful ingest → 200, response has ticker and status='ok'."""
        with patch("routers.sentiment.financial_data_service") as svc:
            svc.ingest_ticker.return_value = {"status": "ok", "ticker": "AAPL", "upserted": 4}
            resp = client.post("/api/v1/sentiment/ingest/AAPL")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["ticker"] == "AAPL"

    def test_ingest_error_status_returns_502(self, client):
        """ingest_ticker returning status='error' → 502."""
        with patch("routers.sentiment.financial_data_service") as svc:
            svc.ingest_ticker.return_value = {"status": "error", "errors": ["Finnhub timeout"]}
            resp = client.post("/api/v1/sentiment/ingest/AAPL")
        assert resp.status_code == 502

    def test_ingest_invalid_period_type_returns_400(self, client):
        """period_type not in (quarterly, annual) → 400."""
        with patch("routers.sentiment.financial_data_service"):
            resp = client.post("/api/v1/sentiment/ingest/AAPL?period_type=monthly")
        assert resp.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/sentiment/llm-input/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestLLMInputEndpoint:

    def test_llm_input_returns_dict_when_data_exists(self, client, sample_llm_input):
        """Stored financial metadata → 200 with llm_input dict."""
        with patch("routers.sentiment.financial_data_service") as svc:
            svc.get_latest_llm_input.return_value = sample_llm_input
            resp = client.get("/api/v1/sentiment/llm-input/AAPL")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert "growth_signals" in data

    def test_llm_input_returns_404_when_no_data(self, client):
        """No ingested data → 404 with helpful detail message."""
        with patch("routers.sentiment.financial_data_service") as svc:
            svc.get_latest_llm_input.return_value = None
            resp = client.get("/api/v1/sentiment/llm-input/AAPL")
        assert resp.status_code == 404
        assert "ingest" in resp.json()["detail"].lower()
