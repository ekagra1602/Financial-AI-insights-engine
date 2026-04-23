import sys
import os
import copy
import pytest

# Make all Backend modules importable from within the tests/ subdirectory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Shared data fixtures ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def sample_report():
    """Complete SentimentReport dict matching the frontend TypeScript type."""
    data = {
        "ticker": "AAPL",
        "companyName": "Apple Inc.",
        "horizon": "1M",
        "generatedAt": "2026-04-23T00:00:00+00:00",
        "forecast": {
            "sentimentScore": 72.5,
            "expectedReturn": 3.38,
            "quantiles": {"q10": -5.0, "q50": 3.38, "q90": 11.76},
        },
        "risk": {
            "flags": [{"id": "rf1", "severity": "low", "message": "Elevated PE ratio"}],
            "topDrivers": [
                {
                    "id": "d1",
                    "factor": "Revenue Growth",
                    "impact": 0.35,
                    "description": "Strong QoQ growth driven by services segment",
                },
            ],
            "confidenceScore": 78,
        },
        "narrative": {
            "stance": "bullish",
            "explanation": "Apple shows strong fundamentals with robust services revenue growth.",
        },
    }
    return copy.deepcopy(data)


@pytest.fixture(scope="session")
def sample_llm_input():
    """Full llm_input dict as returned by FinancialDataService.get_latest_llm_input."""
    data = {
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "industry": "Technology",
        "period_label": "Q1 FY2026",
        "period_type": "quarterly",
        "as_of_date": "2026-01-31",
        "financial_snapshot": {
            "revenue_m": 124000,
            "gross_margin_pct": 43.5,
            "operating_income_m": 35000,
            "net_income_m": 30000,
            "eps_diluted": 1.95,
            "free_cash_flow_m": 28000,
            "cash_m": 52000,
            "total_debt_m": 95000,
        },
        "valuation_snapshot": {
            "pe_ttm": 28.5,
            "ev_ebitda": 22.0,
            "ps_ratio": 7.8,
            "market_cap_b": 3200.0,
        },
        "growth_signals": {
            "revenue_yoy_pct": 4.5,
            "eps_beat": True,
            "eps_surprise_pct": 3.2,
            "eps_beat_rate_4q": 0.75,
        },
        "risk_signals": {
            "debt_equity_ratio": 1.8,
            "current_ratio": 1.1,
            "beta": 1.2,
            "52w_range_pct": 65.0,
        },
        "quality_flags": {
            "has_income_statement": True,
            "has_balance_sheet": True,
            "has_cash_flow": True,
            "has_eps_history": True,
            "data_completeness_pct": 100.0,
        },
    }
    return copy.deepcopy(data)


# ── Database fixture ──────────────────────────────────────────────────────────

@pytest.fixture
def fresh_db(tmp_path, monkeypatch):
    """
    Redirects the SQLite database to a fresh temp file for each test.
    Prevents test pollution and keeps the real stock_data.db untouched.
    """
    import database
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()
    yield db_path


# ── HTTP client fixture ───────────────────────────────────────────────────────

@pytest.fixture
def client(fresh_db):
    """
    TestClient wired to the FastAPI app with a fresh temp database.
    All external service calls (Finnhub, Supabase, AI100) must be mocked
    by individual tests — this fixture only handles the DB isolation.
    """
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
