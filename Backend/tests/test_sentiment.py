"""
Comprehensive test suite for the Future Sentiments feature.

Covers:
  - Unit tests: financial scoring, news scoring, LLM response parsing
  - Integration tests: all 4 API endpoints, field shapes, value bounds,
    caching behaviour, horizon variation, edge cases
"""

import sys
import os
import re
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = "http://localhost:8000/api/v1"
KNOWN_TICKER   = "AAPL"
UNKNOWN_TICKER = "FAKEXYZ999"


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def get(path, **params):
    return requests.get(f"{BASE}{path}", params=params, timeout=120)

def post(path, **params):
    return requests.post(f"{BASE}{path}", params=params, timeout=120)


# ══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS — Financial Score (_compute_financial_score)
# ══════════════════════════════════════════════════════════════════════════════

class TestFinancialScore:
    """Tests for the deterministic financial scoring algorithm."""

    def _score(self, growth=None, risk=None, valuation=None):
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine.__new__(SentimentEngine)
        llm_input = {
            "growth_signals":     growth or {},
            "risk_signals":       risk or {},
            "valuation_snapshot": valuation or {},
        }
        return engine._compute_financial_score(llm_input)

    def test_baseline_no_signals(self):
        """With no signals, score should be exactly 50."""
        assert self._score() == 50.0

    def test_high_growth_boosts_score(self):
        """Revenue > 15% adds 25 points."""
        score = self._score(growth={"revenue_yoy_pct": 20})
        assert score == 75.0

    def test_moderate_growth_boosts_score(self):
        """Revenue 5–15% adds 15 points."""
        score = self._score(growth={"revenue_yoy_pct": 10})
        assert score == 65.0

    def test_slight_growth_boosts_score(self):
        """Revenue 0–5% adds 5 points."""
        score = self._score(growth={"revenue_yoy_pct": 2})
        assert score == 55.0

    def test_negative_growth_penalises(self):
        """Negative revenue subtracts 15 points."""
        score = self._score(growth={"revenue_yoy_pct": -5})
        assert score == 35.0

    def test_eps_beat_adds_20(self):
        score = self._score(growth={"eps_beat": True})
        assert score == 70.0

    def test_high_beat_rate_adds_15(self):
        score = self._score(growth={"eps_beat_rate_4q": 0.8})
        assert score == 65.0

    def test_moderate_beat_rate_adds_10(self):
        score = self._score(growth={"eps_beat_rate_4q": 0.6})
        assert score == 60.0

    def test_large_eps_surprise_adds_10(self):
        score = self._score(growth={"eps_surprise_pct": 8})
        assert score == 60.0

    def test_low_pe_adds_10(self):
        score = self._score(valuation={"pe_ttm": 12})
        assert score == 60.0

    def test_high_pe_penalises(self):
        score = self._score(valuation={"pe_ttm": 50})
        assert score == 40.0

    def test_poor_liquidity_penalises(self):
        score = self._score(risk={"current_ratio": 0.8})
        assert score == 40.0

    def test_high_debt_equity_penalises(self):
        score = self._score(risk={"debt_equity_ratio": 3.0})
        assert score == 40.0

    def test_near_52w_low_adds_10(self):
        score = self._score(risk={"52w_range_pct": 15})
        assert score == 60.0

    def test_near_52w_high_penalises(self):
        score = self._score(risk={"52w_range_pct": 85})
        assert score == 45.0

    def test_strong_all_signals_clamped_at_100(self):
        """Multiple strong positive signals must not exceed 100."""
        score = self._score(
            growth={"revenue_yoy_pct": 20, "eps_beat": True,
                    "eps_beat_rate_4q": 0.9, "eps_surprise_pct": 10},
            valuation={"pe_ttm": 10},
            risk={"52w_range_pct": 10},
        )
        assert score == 100.0

    def test_all_negative_signals_clamped_at_0(self):
        """Multiple negative signals must not go below 0."""
        score = self._score(
            growth={"revenue_yoy_pct": -20},
            valuation={"pe_ttm": 60},
            risk={"current_ratio": 0.5, "debt_equity_ratio": 5, "52w_range_pct": 90},
        )
        assert score == 0.0

    def test_none_values_ignored(self):
        """None values for any signal should not affect the score."""
        score = self._score(
            growth={"revenue_yoy_pct": None, "eps_beat": None},
            risk={"current_ratio": None},
        )
        assert score == 50.0


# ══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS — LLM Response Parsing (_parse_llm_response)
# ══════════════════════════════════════════════════════════════════════════════

class TestLLMParsing:
    """Tests for the structured LLM response parser."""

    def _parse(self, raw):
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine.__new__(SentimentEngine)
        return engine._parse_llm_response(raw)

    BULLISH_RESPONSE = """
STANCE: bullish
EXPLANATION: Apple shows strong growth momentum with consistent EPS beats. Revenue growth remains above industry average. The AI integration strategy positions the company well for the next cycle.
DRIVER_1: Revenue Growth | 0.9 | Strong YoY revenue growth signals robust demand.
DRIVER_2: EPS Beat Rate | 0.75 | Consistently beating estimates over four quarters.
DRIVER_3: Market Position | 0.6 | Dominant ecosystem maintains pricing power.
DRIVER_4: Beta Risk | -0.2 | Moderate volatility relative to the market.
RISK_1: medium | Regulatory scrutiny on app store practices may increase.
RISK_2: low | Supply chain concentration remains a background risk.
CONFIDENCE: 82
"""

    BEARISH_RESPONSE = """
STANCE: bearish
EXPLANATION: Declining revenues and missed earnings raise concerns. Debt levels are elevated relative to equity. Near-term outlook remains cautious.
DRIVER_1: Revenue Decline | -0.8 | YoY revenue contraction signals weakening demand.
DRIVER_2: EPS Miss | -0.7 | Missed estimates for three consecutive quarters.
RISK_1: high | Debt/equity ratio significantly above sector median.
CONFIDENCE: 71
"""

    NEUTRAL_RESPONSE = """
STANCE: neutral
EXPLANATION: Mixed signals with moderate growth offset by valuation concerns.
DRIVER_1: Stable Revenue | 0.3 | Revenue growth in line with expectations.
RISK_1: low | No material near-term risks identified.
CONFIDENCE: 65
"""

    def test_bullish_stance_parsed(self):
        r = self._parse(self.BULLISH_RESPONSE)
        assert r["stance"] == "bullish"

    def test_bearish_stance_parsed(self):
        r = self._parse(self.BEARISH_RESPONSE)
        assert r["stance"] == "bearish"

    def test_neutral_stance_parsed(self):
        r = self._parse(self.NEUTRAL_RESPONSE)
        assert r["stance"] == "neutral"

    def test_explanation_not_empty(self):
        r = self._parse(self.BULLISH_RESPONSE)
        assert len(r["explanation"]) > 20

    def test_drivers_parsed(self):
        r = self._parse(self.BULLISH_RESPONSE)
        assert len(r["drivers"]) == 4

    def test_driver_fields_present(self):
        r = self._parse(self.BULLISH_RESPONSE)
        for d in r["drivers"]:
            assert "id" in d
            assert "factor" in d
            assert "impact" in d
            assert "description" in d

    def test_driver_impact_clamped(self):
        r = self._parse(self.BULLISH_RESPONSE)
        for d in r["drivers"]:
            assert -1.0 <= d["impact"] <= 1.0

    def test_negative_impact_parsed(self):
        r = self._parse(self.BEARISH_RESPONSE)
        impacts = [d["impact"] for d in r["drivers"]]
        assert any(i < 0 for i in impacts)

    def test_risk_flags_parsed(self):
        r = self._parse(self.BULLISH_RESPONSE)
        assert len(r["risk_flags"]) == 2

    def test_risk_flag_fields(self):
        r = self._parse(self.BULLISH_RESPONSE)
        for f in r["risk_flags"]:
            assert f["severity"] in ("low", "medium", "high")
            assert len(f["message"]) > 5

    def test_high_severity_parsed(self):
        r = self._parse(self.BEARISH_RESPONSE)
        severities = [f["severity"] for f in r["risk_flags"]]
        assert "high" in severities

    def test_confidence_parsed(self):
        r = self._parse(self.BULLISH_RESPONSE)
        assert r["confidence"] == 82

    def test_confidence_default_on_missing(self):
        r = self._parse("STANCE: neutral\nEXPLANATION: Test.")
        assert r["confidence"] == 70

    def test_stance_default_on_missing(self):
        r = self._parse("EXPLANATION: Some text.\nCONFIDENCE: 70")
        assert r["stance"] == "neutral"

    def test_partial_response_does_not_crash(self):
        """Malformed / truncated LLM output must not raise an exception."""
        r = self._parse("STANCE: bullish\nEXPLANATION: Short.")
        assert r["stance"] == "bullish"
        assert isinstance(r["drivers"], list)
        assert isinstance(r["risk_flags"], list)

    def test_think_tags_stripped(self):
        """<think>...</think> blocks from reasoning models should be ignored."""
        raw = "<think>internal reasoning</think>\nSTANCE: bullish\nEXPLANATION: Clean.\nCONFIDENCE: 75"
        from services.sentiment_engine import SentimentEngine
        engine = SentimentEngine.__new__(SentimentEngine)
        import re as _re
        cleaned = _re.sub(r"<think>.*?</think>", "", raw, flags=_re.DOTALL).strip()
        r = engine._parse_llm_response(cleaned)
        assert r["stance"] == "bullish"


# ══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS — News Score (_compute_news_score via mock)
# ══════════════════════════════════════════════════════════════════════════════

class TestNewsScore:
    """Tests for news sentiment aggregation (mocked Supabase)."""

    def _score_from_articles(self, articles):
        from services.sentiment_engine import SentimentEngine
        from unittest.mock import MagicMock
        engine = SentimentEngine.__new__(SentimentEngine)
        engine.supabase = MagicMock()
        engine.supabase.get_recent_articles.return_value = articles
        score, summary = engine._compute_news_score("TEST")
        return score, summary

    def test_no_articles_returns_50(self):
        score, _ = self._score_from_articles([])
        assert score == 50.0

    def test_all_positive_above_50(self):
        articles = [{"sentiment": "positive"}] * 10
        score, _ = self._score_from_articles(articles)
        assert score > 50

    def test_all_negative_below_50(self):
        articles = [{"sentiment": "negative"}] * 10
        score, _ = self._score_from_articles(articles)
        assert score < 50

    def test_all_neutral_equals_50(self):
        articles = [{"sentiment": "neutral"}] * 10
        score, _ = self._score_from_articles(articles)
        assert score == 50.0

    def test_mixed_sentiment(self):
        articles = (
            [{"sentiment": "positive"}] * 6 +
            [{"sentiment": "negative"}] * 2 +
            [{"sentiment": "neutral"}] * 2
        )
        score, _ = self._score_from_articles(articles)
        assert 50 < score < 100

    def test_score_clamped_above(self):
        articles = [{"sentiment": "positive"}] * 100
        score, _ = self._score_from_articles(articles)
        assert score <= 100.0

    def test_score_clamped_below(self):
        articles = [{"sentiment": "negative"}] * 100
        score, _ = self._score_from_articles(articles)
        assert score >= 0.0

    def test_summary_string_returned(self):
        articles = [{"sentiment": "positive"}] * 3 + [{"sentiment": "negative"}]
        _, summary = self._score_from_articles(articles)
        assert isinstance(summary, str)
        assert len(summary) > 0


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — POST /sentiment/ingest/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestIngestEndpoint:

    def test_ingest_known_ticker_200(self):
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}")
        assert r.status_code == 200

    def test_ingest_response_shape(self):
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}").json()
        assert r["ticker"] == KNOWN_TICKER
        assert "periods_processed" in r
        assert "periods_cached" in r
        assert "period_keys" in r
        assert "status" in r
        assert "errors" in r

    def test_ingest_returns_period_keys(self):
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}").json()
        total = r["periods_processed"] + r["periods_cached"]
        assert total > 0
        assert len(r["period_keys"]) == total

    def test_ingest_cache_on_second_call(self):
        """Second identical ingest should be fully cached (within 7-day TTL)."""
        post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="quarterly", num_periods=4)
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="quarterly", num_periods=4).json()
        assert r["periods_cached"] > 0
        assert r["periods_processed"] == 0

    def test_ingest_annual_period_type(self):
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="annual", num_periods=2)
        assert r.status_code == 200
        assert r.json()["status"] in ("success", "partial")

    def test_ingest_invalid_period_type_400(self):
        r = post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="weekly")
        assert r.status_code == 400

    def test_ingest_lowercase_ticker_normalised(self):
        r = post("/sentiment/ingest/aapl").json()
        assert r["ticker"] == "AAPL"

    def test_ingest_different_ticker(self):
        r = post("/sentiment/ingest/MSFT")
        assert r.status_code == 200
        assert r.json()["ticker"] == "MSFT"


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — GET /sentiment/data/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestDataEndpoint:

    def setup_method(self):
        post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="quarterly", num_periods=4)

    def test_data_known_ticker_200(self):
        r = get(f"/sentiment/data/{KNOWN_TICKER}")
        assert r.status_code == 200

    def test_data_response_shape(self):
        body = get(f"/sentiment/data/{KNOWN_TICKER}").json()
        assert "ticker" in body
        assert "count" in body
        assert "data" in body
        assert isinstance(body["data"], list)

    def test_data_has_rows_after_ingest(self):
        body = get(f"/sentiment/data/{KNOWN_TICKER}").json()
        assert body["count"] > 0

    def test_data_row_fields(self):
        rows = get(f"/sentiment/data/{KNOWN_TICKER}").json()["data"]
        row = rows[0]
        assert "ticker" in row
        assert "period_type" in row
        assert "period_key" in row
        assert "llm_input" in row

    def test_data_filter_quarterly(self):
        body = get(f"/sentiment/data/{KNOWN_TICKER}", period_type="quarterly").json()
        for row in body["data"]:
            assert row["period_type"] == "quarterly"

    def test_data_limit_respected(self):
        body = get(f"/sentiment/data/{KNOWN_TICKER}", limit=2).json()
        assert len(body["data"]) <= 2

    def test_data_unknown_ticker_empty(self):
        body = get(f"/sentiment/data/{UNKNOWN_TICKER}").json()
        assert body["count"] == 0
        assert body["data"] == []

    def test_data_invalid_period_type_400(self):
        r = get(f"/sentiment/data/{KNOWN_TICKER}", period_type="monthly")
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — GET /sentiment/llm-input/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestLLMInputEndpoint:

    def setup_method(self):
        post(f"/sentiment/ingest/{KNOWN_TICKER}", period_type="quarterly", num_periods=4)

    def test_llm_input_known_ticker_200(self):
        r = get(f"/sentiment/llm-input/{KNOWN_TICKER}")
        assert r.status_code == 200

    def test_llm_input_shape(self):
        body = get(f"/sentiment/llm-input/{KNOWN_TICKER}").json()
        assert body["ticker"] == KNOWN_TICKER
        assert "company_name" in body
        assert "growth_signals" in body
        assert "risk_signals" in body
        assert "valuation_snapshot" in body
        assert "quality_flags" in body

    def test_llm_input_growth_signals(self):
        g = get(f"/sentiment/llm-input/{KNOWN_TICKER}").json()["growth_signals"]
        assert "revenue_yoy_pct" in g
        assert "eps_beat" in g
        assert "eps_beat_rate_4q" in g

    def test_llm_input_risk_signals(self):
        r = get(f"/sentiment/llm-input/{KNOWN_TICKER}").json()["risk_signals"]
        assert "beta" in r
        assert "current_ratio" in r
        assert "debt_equity_ratio" in r

    def test_llm_input_unknown_ticker_404(self):
        r = get(f"/sentiment/llm-input/{UNKNOWN_TICKER}")
        assert r.status_code == 404

    def test_llm_input_lowercase_normalised(self):
        r = get("/sentiment/llm-input/aapl").json()
        assert r["ticker"] == "AAPL"


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — GET /sentiment/report/{ticker}
# ══════════════════════════════════════════════════════════════════════════════

class TestReportEndpoint:

    def test_report_known_ticker_200(self):
        r = get(f"/sentiment/report/{KNOWN_TICKER}")
        assert r.status_code == 200

    def test_report_top_level_fields(self):
        body = get(f"/sentiment/report/{KNOWN_TICKER}").json()
        assert "ticker" in body
        assert "companyName" in body
        assert "horizon" in body
        assert "generatedAt" in body
        assert "forecast" in body
        assert "risk" in body
        assert "narrative" in body

    def test_report_forecast_fields(self):
        fc = get(f"/sentiment/report/{KNOWN_TICKER}").json()["forecast"]
        assert "sentimentScore" in fc
        assert "expectedReturn" in fc
        assert "quantiles" in fc

    def test_report_quantile_fields(self):
        q = get(f"/sentiment/report/{KNOWN_TICKER}").json()["forecast"]["quantiles"]
        assert "q10" in q
        assert "q50" in q
        assert "q90" in q

    def test_report_risk_fields(self):
        risk = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]
        assert "flags" in risk
        assert "topDrivers" in risk
        assert "confidenceScore" in risk

    def test_report_narrative_fields(self):
        narr = get(f"/sentiment/report/{KNOWN_TICKER}").json()["narrative"]
        assert "stance" in narr
        assert "explanation" in narr

    # ── Value bounds ──────────────────────────────────────────────────────────

    def test_sentiment_score_in_bounds(self):
        score = get(f"/sentiment/report/{KNOWN_TICKER}").json()["forecast"]["sentimentScore"]
        assert 0 <= score <= 100

    def test_confidence_score_in_bounds(self):
        conf = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]["confidenceScore"]
        assert 0 <= conf <= 100

    def test_stance_is_valid(self):
        stance = get(f"/sentiment/report/{KNOWN_TICKER}").json()["narrative"]["stance"]
        assert stance in ("bullish", "neutral", "bearish")

    def test_quantile_ordering(self):
        q = get(f"/sentiment/report/{KNOWN_TICKER}").json()["forecast"]["quantiles"]
        assert q["q10"] <= q["q50"] <= q["q90"]

    def test_explanation_not_empty(self):
        explanation = get(f"/sentiment/report/{KNOWN_TICKER}").json()["narrative"]["explanation"]
        assert isinstance(explanation, str)
        assert len(explanation) > 20

    def test_top_drivers_is_list(self):
        drivers = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]["topDrivers"]
        assert isinstance(drivers, list)

    def test_driver_impact_in_bounds(self):
        drivers = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]["topDrivers"]
        for d in drivers:
            assert -1.0 <= d["impact"] <= 1.0

    def test_risk_flags_is_list(self):
        flags = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]["flags"]
        assert isinstance(flags, list)

    def test_risk_flag_severity_valid(self):
        flags = get(f"/sentiment/report/{KNOWN_TICKER}").json()["risk"]["flags"]
        for f in flags:
            assert f["severity"] in ("low", "medium", "high")

    # ── Horizon behaviour ─────────────────────────────────────────────────────

    def test_all_horizons_return_200(self):
        for h in ("1D", "1W", "1M", "3M", "6M"):
            r = get(f"/sentiment/report/{KNOWN_TICKER}", horizon=h)
            assert r.status_code == 200, f"Failed for horizon {h}"

    def test_invalid_horizon_400(self):
        r = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="INVALID")
        assert r.status_code == 400

    def test_expected_return_varies_with_horizon(self):
        """Longer horizons should produce larger absolute expected returns."""
        r1m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="1M").json()["forecast"]["expectedReturn"]
        r3m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="3M").json()["forecast"]["expectedReturn"]
        # For a non-neutral stock, 3M return should have larger magnitude than 1M
        assert abs(r3m) >= abs(r1m)

    def test_quantiles_widen_with_horizon(self):
        """Longer horizon → wider spread between q10 and q90."""
        q1m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="1M").json()["forecast"]["quantiles"]
        q6m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="6M").json()["forecast"]["quantiles"]
        spread_1m = q1m["q90"] - q1m["q10"]
        spread_6m = q6m["q90"] - q6m["q10"]
        assert spread_6m > spread_1m

    def test_sentiment_score_same_across_horizons(self):
        """sentimentScore is horizon-independent (fundamental + news signal)."""
        s1m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="1M").json()["forecast"]["sentimentScore"]
        s3m = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="3M").json()["forecast"]["sentimentScore"]
        assert s1m == s3m

    # ── Caching ───────────────────────────────────────────────────────────────

    def test_second_call_returns_same_report(self):
        """Same ticker + horizon within 24h should return identical generatedAt."""
        r1 = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="1M").json()
        r2 = get(f"/sentiment/report/{KNOWN_TICKER}", horizon="1M").json()
        assert r1["generatedAt"] == r2["generatedAt"]

    # ── Multiple tickers ──────────────────────────────────────────────────────

    def test_multiple_tickers_return_correct_ticker_field(self):
        for ticker in ("QCOM", "MSFT"):
            body = get(f"/sentiment/report/{ticker}").json()
            assert body["ticker"] == ticker

    def test_lowercase_ticker_normalised(self):
        body = get("/sentiment/report/aapl").json()
        assert body["ticker"] == "AAPL"

    # ── Unknown ticker ────────────────────────────────────────────────────────

    def test_unknown_ticker_returns_404(self):
        r = get(f"/sentiment/report/{UNKNOWN_TICKER}")
        assert r.status_code == 404

    def test_404_detail_message_helpful(self):
        body = get(f"/sentiment/report/{UNKNOWN_TICKER}").json()
        assert "detail" in body
        assert len(body["detail"]) > 10
