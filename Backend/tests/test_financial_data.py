"""
13 tests covering FinancialDataService internal calculations:
  FCF (2), 52W range position (3), data completeness (3),
  Finnhub field mapping (2), freshness check (3).
"""
import pytest
import datetime
from unittest.mock import MagicMock, patch


def _make_svc():
    """Instantiate without calling __init__ (avoids live Supabase connection)."""
    from services.financial_data_service import FinancialDataService
    svc = FinancialDataService.__new__(FinancialDataService)
    svc.supabase = MagicMock()
    return svc


def _cf_report(operating_cf, capex):
    """Build a minimal Finnhub financials-reported shape for cash flow tests."""
    return {
        "report": {
            "cf": [
                {"concept": "NetCashProvidedByUsedInOperatingActivities", "value": operating_cf},
                {"concept": "PaymentsToAcquirePropertyPlantAndEquipment", "value": capex},
            ],
            "ic": [],
            "bs": [],
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# FCF = operating_cf + capex  (Finnhub stores capex as a negative number)
# ══════════════════════════════════════════════════════════════════════════════

class TestFCFCalculation:

    def test_fcf_positive_when_capex_negative(self):
        svc = _make_svc()
        result = svc._normalize_financials(_cf_report(500, -200))
        assert result["cash_flow"]["free_cash_flow"] == 300

    def test_fcf_negative_when_capex_exceeds_operating_cf(self):
        svc = _make_svc()
        result = svc._normalize_financials(_cf_report(100, -400))
        assert result["cash_flow"]["free_cash_flow"] == -300


# ══════════════════════════════════════════════════════════════════════════════
# 52-week range position  (0 = at low, 100 = at high, clamped)
# ══════════════════════════════════════════════════════════════════════════════

def _mkt(high, low):
    return {"52_week_high": high, "52_week_low": low}


def _call_build(price, mkt):
    svc = _make_svc()
    result = svc._build_llm_input(
        ticker="TEST",
        profile={"name": "Test Co", "finnhubIndustry": "Tech"},
        period_meta={"period_label": "Q1 FY2026", "period_type": "quarterly"},
        financials={
            "income_statement": {}, "balance_sheet": {}, "cash_flow": {},
            "filing_date": "2026-01-31",
        },
        key_metrics={
            "valuation": {}, "profitability": {}, "growth": {},
            "liquidity": {}, "market": mkt,
        },
        eps_data={},
        current_price=price,
    )
    return result["risk_signals"]["52w_range_pct"]


class TestRangePosition:

    def test_midpoint_returns_50(self):
        assert _call_build(150, _mkt(200, 100)) == 50.0

    def test_clamps_above_100(self):
        assert _call_build(210, _mkt(200, 100)) == 100.0

    def test_clamps_below_0(self):
        assert _call_build(90, _mkt(200, 100)) == 0.0


# ══════════════════════════════════════════════════════════════════════════════
# Data completeness (8 key fields, 0–100%)
# ══════════════════════════════════════════════════════════════════════════════

def _build_with_financials(ic=None, bs=None, cf=None, eps_actual=None):
    svc = _make_svc()
    result = svc._build_llm_input(
        ticker="TEST",
        profile={"name": "Test Co", "finnhubIndustry": "Tech"},
        period_meta={"period_label": "Q1 FY2026", "period_type": "quarterly"},
        financials={
            "income_statement": ic or {},
            "balance_sheet": bs or {},
            "cash_flow": cf or {},
            "filing_date": "2026-01-31",
        },
        key_metrics={
            "valuation": {}, "profitability": {}, "growth": {},
            "liquidity": {}, "market": {},
        },
        eps_data={"current_period": {"actual": eps_actual}} if eps_actual else {},
        current_price=None,
    )
    return result["quality_flags"]["data_completeness_pct"]


class TestDataCompleteness:

    def test_all_8_fields_present_returns_100(self):
        pct = _build_with_financials(
            ic={"revenue": 1000, "net_income": 200, "eps_diluted": 1.5},
            bs={"total_assets": 5000, "total_equity": 2000},
            cf={"operating_cash_flow": 300, "free_cash_flow": 250},
            eps_actual=1.5,
        )
        assert pct == 100.0

    def test_4_of_8_fields_returns_50(self):
        pct = _build_with_financials(
            ic={"revenue": 1000, "net_income": 200},
            bs={"total_assets": 5000, "total_equity": 2000},
        )
        assert pct == 50.0

    def test_zero_fields_returns_0(self):
        pct = _build_with_financials()
        assert pct == 0.0


# ══════════════════════════════════════════════════════════════════════════════
# Finnhub field mapping
# ══════════════════════════════════════════════════════════════════════════════

class TestFinnhubFieldMapping:

    def test_roa_reads_roa5y_not_roa_ttm(self):
        """roa5Y Finnhub key -> roa_5y in our schema."""
        svc = _make_svc()
        raw = {"roa5Y": 0.18, "roaTTM": 0.22}
        result = svc._normalize_key_metrics(raw)
        assert result["profitability"]["roa_5y"] == 0.18

    def test_roa_ttm_key_is_not_used_for_roa_5y(self):
        """Passing only roaTTM (without roa5Y) leaves roa_5y as None."""
        svc = _make_svc()
        raw = {"roaTTM": 0.22}
        result = svc._normalize_key_metrics(raw)
        assert result["profitability"]["roa_5y"] is None


# ══════════════════════════════════════════════════════════════════════════════
# Freshness check: ingest_ticker fast-path
# ══════════════════════════════════════════════════════════════════════════════

class TestFreshnessCheck:

    def test_fresh_data_skips_finnhub_calls(self):
        """4 rows all updated < 7 days ago -> Finnhub not called."""
        svc = _make_svc()
        fresh_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        svc.supabase.get_financial_metadata.return_value = [
            {"updated_at": fresh_ts, "llm_input": {}, "period_key": f"2025-Q{i+1}"}
            for i in range(4)
        ]
        with patch("services.financial_data_service.get_financials_reported") as mock_finnhub:
            svc.ingest_ticker("AAPL", "quarterly", 4)
        mock_finnhub.assert_not_called()

    def test_stale_data_triggers_finnhub_calls(self):
        """Row updated 8 days ago -> Finnhub IS called."""
        svc = _make_svc()
        stale_ts = (
            datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=8)
        ).isoformat()
        svc.supabase.get_financial_metadata.return_value = [
            {"updated_at": stale_ts, "llm_input": {}}
        ]
        with patch("services.financial_data_service.get_financials_reported") as mock_fin, \
             patch("services.financial_data_service.get_stock_earnings", return_value=[]), \
             patch("services.financial_data_service.get_finnhub_metric", return_value={"metric": {}}), \
             patch("services.financial_data_service.get_finnhub_profile", return_value={}), \
             patch("services.financial_data_service.get_finnhub_quote", return_value={"c": 150}):
            mock_fin.return_value = {"data": []}  # empty periods -> nothing to upsert
            svc.ingest_ticker("AAPL", "quarterly", 4)
        mock_fin.assert_called_once()

    def test_missing_data_triggers_finnhub_calls(self):
        """No rows at all in Supabase -> Finnhub IS called."""
        svc = _make_svc()
        svc.supabase.get_financial_metadata.return_value = []
        with patch("services.financial_data_service.get_financials_reported") as mock_fin, \
             patch("services.financial_data_service.get_stock_earnings", return_value=[]), \
             patch("services.financial_data_service.get_finnhub_metric", return_value={"metric": {}}), \
             patch("services.financial_data_service.get_finnhub_profile", return_value={}), \
             patch("services.financial_data_service.get_finnhub_quote", return_value={"c": 150}):
            mock_fin.return_value = {"data": []}  # empty periods -> nothing to upsert
            svc.ingest_ticker("AAPL", "quarterly", 4)
        mock_fin.assert_called_once()
