"""
8 always-on unit-integration tests + 5 live tests (auto-skipped without creds).
Unit-integration tests call SentimentEngine methods directly with all
external dependencies mocked.
"""
import os
import datetime
import pytest
from unittest.mock import MagicMock, patch


# ══════════════════════════════════════════════════════════════════════════════
# Always-on: SentimentEngine internal contract tests
# ══════════════════════════════════════════════════════════════════════════════

def _make_engine(supabase_returns_none=True, llm_result=None, news_score=60.0,
                 financial_score=70.0, llm_input=None):
    """
    Build a SentimentEngine with all external calls mocked.
    Returns (engine, mock_supabase).
    """
    from services.sentiment_engine import SentimentEngine
    engine = SentimentEngine.__new__(SentimentEngine)

    # Mock supabase
    mock_sup = MagicMock()
    mock_sup.get_sentiment_report.return_value = None if supabase_returns_none else {"report": {}}
    mock_sup.save_sentiment_report.return_value = None
    mock_sup.get_recent_articles.return_value = []
    engine.supabase = mock_sup

    # Mock financial service
    mock_fin = MagicMock()
    mock_fin.ingest_ticker.return_value = {"status": "ok"}
    mock_fin.get_latest_llm_input.return_value = llm_input or {
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "industry": "Technology",
        "period_label": "Q1 FY2026",
        "period_type": "quarterly",
        "as_of_date": "2026-01-31",
        "financial_snapshot": {
            "revenue_m": 124000, "gross_margin_pct": 43.5,
            "operating_income_m": 35000, "net_income_m": 30000,
            "eps_diluted": 1.95, "free_cash_flow_m": 28000,
            "cash_m": 52000, "total_debt_m": 95000,
        },
        "valuation_snapshot": {"pe_ttm": 28.5, "ev_ebitda": 22.0, "ps_ratio": 7.8, "market_cap_b": 3200.0},
        "growth_signals": {"revenue_yoy_pct": 4.5, "eps_beat": True, "eps_surprise_pct": 3.2, "eps_beat_rate_4q": 0.75},
        "risk_signals": {"debt_equity_ratio": 1.8, "current_ratio": 1.1, "beta": 1.2, "52w_range_pct": 65.0},
        "quality_flags": {
            "has_income_statement": True, "has_balance_sheet": True,
            "has_cash_flow": True, "has_eps_history": True,
            "data_completeness_pct": 100.0,
        },
    }
    engine.financial_service = mock_fin

    # Mock LLM
    _llm_result = llm_result or {
        "stance": "bullish",
        "explanation": "Strong fundamentals.",
        "drivers": [{"id": "d1", "factor": "Revenue", "impact": 0.3, "description": "Growing"}],
        "risk_flags": [],
    }
    engine._call_llm = MagicMock(return_value=_llm_result)

    # Mock _compute_news_score to return deterministic 2-tuple
    engine._compute_news_score = MagicMock(return_value=(news_score, "Positive news coverage."))
    engine._last_article_count = 5

    # Mock _compute_financial_score
    engine._compute_financial_score = MagicMock(return_value=financial_score)

    return engine, mock_sup


class TestSentimentUnitIntegration:

    def test_full_report_has_all_7_required_keys(self):
        engine, _ = _make_engine()
        report = engine.generate_report("AAPL", "1M")
        for key in ("ticker", "companyName", "horizon", "generatedAt", "forecast", "risk", "narrative"):
            assert key in report, f"Missing key: {key}"

    def test_score_weights_055_financial_045_news(self):
        """sentimentScore = 0.55 * financial + 0.45 * news."""
        engine, _ = _make_engine(financial_score=80.0, news_score=60.0)
        report = engine.generate_report("AAPL", "1M")
        expected = round(0.55 * 80.0 + 0.45 * 60.0, 1)
        assert report["forecast"]["sentimentScore"] == expected

    def test_confidence_score_is_deterministic(self, sample_llm_input):
        """Same inputs → same confidenceScore on two consecutive calls."""
        engine, _ = _make_engine(llm_input=sample_llm_input)
        r1 = engine.generate_report("AAPL", "1M")
        # Reset cache mock so the second call re-runs the same path
        engine.supabase.get_sentiment_report.return_value = None
        r2 = engine.generate_report("AAPL", "1M")
        assert r1["risk"]["confidenceScore"] == r2["risk"]["confidenceScore"]

    def test_news_score_returns_2_tuple_and_sets_last_article_count(self):
        """
        _compute_news_score contract: returns exactly (score, summary) 2-tuple;
        self._last_article_count is set before return.
        """
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine.__new__(SentimentEngine)
        engine.supabase = MagicMock()
        engine.supabase.get_recent_articles.return_value = [
            {"sentiment": "positive"}, {"sentiment": "negative"}, {"sentiment": "positive"},
        ]
        result = engine._compute_news_score("AAPL", "1M")
        assert isinstance(result, tuple), "Must return a tuple"
        assert len(result) == 2, "Must be a 2-tuple (score, summary)"
        score, summary = result
        assert isinstance(score, float)
        assert isinstance(summary, str)
        assert hasattr(engine, "_last_article_count"), "Must set self._last_article_count"
        assert engine._last_article_count == 3

    def test_cache_write_called_with_24h_expiry(self):
        """After generation, supabase.save_sentiment_report is called once with expires_at ~24h ahead."""
        engine, mock_sup = _make_engine()
        engine.generate_report("AAPL", "1M")
        mock_sup.save_sentiment_report.assert_called_once()
        call_kwargs = mock_sup.save_sentiment_report.call_args[0][0]
        expires_at = datetime.datetime.fromisoformat(call_kwargs["expires_at"])
        now = datetime.datetime.now(datetime.timezone.utc)
        delta_hours = (expires_at - now).total_seconds() / 3600
        assert 23 < delta_hours < 25, f"expires_at should be ~24h ahead, got {delta_hours:.1f}h"

    def test_force_refresh_skips_supabase_read(self):
        """force_refresh=True → supabase.get_sentiment_report never called."""
        engine, mock_sup = _make_engine()
        engine.generate_report("AAPL", "1M", force_refresh=True)
        mock_sup.get_sentiment_report.assert_not_called()

    def test_cache_hit_returns_cached_report_without_generation(self):
        """When Supabase has a cached report, generate_report returns it without calling LLM or saving."""
        engine, mock_sup = _make_engine(supabase_returns_none=False)
        report = engine.generate_report("AAPL", "1M")
        assert report == {}  # mock returns {"report": {}}
        mock_sup.save_sentiment_report.assert_not_called()
        engine._call_llm.assert_not_called()

    def test_horizon_1d_uses_short_lookback(self):
        """1D horizon → news lookback window is 2 days (HORIZON_LOOKBACK_DAYS['1D']=2)."""
        from services.sentiment_engine import HORIZON_LOOKBACK_DAYS
        assert HORIZON_LOOKBACK_DAYS["1D"] == 2

    def test_horizon_6m_uses_long_lookback(self):
        """6M horizon → news lookback window is 180 days."""
        from services.sentiment_engine import HORIZON_LOOKBACK_DAYS
        assert HORIZON_LOOKBACK_DAYS["6M"] == 180


# ══════════════════════════════════════════════════════════════════════════════
# Live integration tests — auto-skipped without real credentials
# ══════════════════════════════════════════════════════════════════════════════

_CREDS = ["FINNHUB_API_KEY", "SUPABASE_URL", "SUPABASE_KEY", "AI100_API_KEY"]
_ALL_CREDS_PRESENT = all(os.getenv(v) for v in _CREDS)


@pytest.mark.skipif(not _ALL_CREDS_PRESENT, reason="Live credentials not configured")
class TestSentimentLiveIntegration:

    def test_live_ingest_aapl(self):
        """Ingest AAPL against real Finnhub + Supabase. Verifies at least 1 row stored."""
        from services.financial_data_service import FinancialDataService
        svc = FinancialDataService()
        result = svc.ingest_ticker("AAPL", "quarterly", 4)
        assert result.get("status") in ("ok", "success", "partial")

    def test_live_generate_report_all_keys_present(self):
        """Full pipeline against real services. All 7 keys present; scores in valid ranges."""
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine()
        report = engine.generate_report("AAPL", "1M")
        for key in ("ticker", "companyName", "horizon", "generatedAt", "forecast", "risk", "narrative"):
            assert key in report
        assert 0 <= report["forecast"]["sentimentScore"] <= 100
        assert 0 <= report["risk"]["confidenceScore"] <= 100
        assert report["narrative"]["stance"] in ("bullish", "bearish", "neutral")

    def test_live_cache_hit_returns_same_generated_at(self):
        """Two consecutive calls: second returns same generatedAt (Supabase cache hit)."""
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine()
        r1 = engine.generate_report("AAPL", "1M")
        r2 = engine.generate_report("AAPL", "1M")
        assert r1["generatedAt"] == r2["generatedAt"], "Second call should return cached report"

    def test_live_report_endpoint_returns_200(self):
        """GET /api/v1/sentiment/report/AAPL against live server."""
        import requests
        resp = requests.get("http://localhost:8000/api/v1/sentiment/report/AAPL", timeout=120)
        assert resp.status_code == 200
        assert resp.json()["ticker"] == "AAPL"

    def test_live_force_refresh_generates_new_report(self):
        """force_refresh=true must produce a new report, not return the cached one."""
        import requests
        r1 = requests.get("http://localhost:8000/api/v1/sentiment/report/AAPL", timeout=120).json()
        r2 = requests.get(
            "http://localhost:8000/api/v1/sentiment/report/AAPL?force_refresh=true", timeout=120
        ).json()
        assert r2["generatedAt"] != r1["generatedAt"], (
            "force_refresh=true must produce a new report, not return the cached one"
        )
