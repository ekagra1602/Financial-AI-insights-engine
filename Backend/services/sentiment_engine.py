import math
import re
import datetime
import requests
from typing import Optional, Dict, Any

from services.supabase_client import SupabaseClient
from services.financial_data_service import FinancialDataService
from services import ai100_client

HORIZON_MONTHS = {
    "1D": 0.033,
    "1W": 0.25,
    "1M": 1,
    "3M": 3,
    "6M": 6,
}

# How far back to look for news articles per horizon.
# Shorter horizons need recent signals; longer horizons need broader context.
HORIZON_LOOKBACK_DAYS = {
    "1D": 2,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
}

# Horizon-specific reasoning guidance injected into the LLM prompt.
# Steers the qualitative narrative without asking the LLM to compute numbers.
HORIZON_GUIDANCE = {
    "1D": (
        "This is a SHORT-TERM (1-day) outlook. Focus ONLY on immediate news catalysts from the last 24-48 hours, "
        "very recent sentiment momentum, and near-term price drivers. "
        "Ignore long-term structural factors such as competitive moat or multi-year growth trajectories."
    ),
    "1W": (
        "This is a SHORT-TERM (1-week) outlook. Focus on this week's news momentum, the most recent earnings reaction, "
        "and short-term sector trends. De-emphasise long-term competitive positioning."
    ),
    "1M": (
        "This is a MEDIUM-TERM (1-month) outlook. Focus on upcoming earnings catalysts, current valuation vs peers, "
        "recent revenue trend, and sector dynamics likely to play out over the next month."
    ),
    "3M": (
        "This is a MEDIUM-TERM (3-month) outlook. Focus on the next 1-2 earnings reports, revenue growth trajectory, "
        "competitive positioning, and macro tailwinds or headwinds expected over the coming quarter."
    ),
    "6M": (
        "This is a LONG-TERM (6-month) outlook. Focus on multi-quarter revenue growth trend, debt sustainability, "
        "competitive moat, long-term margin trajectory, and structural industry shifts. "
        "Near-term news noise is less relevant here."
    ),
}


class SentimentEngine:
    def __init__(self):
        self.supabase = SupabaseClient()
        self.financial_service = FinancialDataService()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def generate_report(self, ticker: str, horizon: str = "1M") -> Dict[str, Any]:
        """
        Main entry point. Returns a complete SentimentReport dict matching
        the frontend's TypeScript type. Cached in Supabase for 24 hours.
        """
        ticker = ticker.upper()

        # 1. Return cached report if still valid
        cached = self.supabase.get_sentiment_report(ticker, horizon)
        if cached:
            return cached["report"]

        # 2. Ensure financial data is ingested (7-day cache inside ingest_ticker)
        self.financial_service.ingest_ticker(ticker, period_type="quarterly", num_periods=4)
        llm_input = self.financial_service.get_latest_llm_input(ticker, period_type="quarterly")

        if not llm_input:
            raise ValueError(f"No financial data available for {ticker}. Ingestion may have failed.")

        # 3. News sentiment score from Supabase (horizon-aware lookback window)
        news_score, news_summary, article_count = self._compute_news_score(ticker, horizon)

        # 4. Financial score from llm_input
        financial_score = self._compute_financial_score(llm_input)

        # 5. Sentiment score (weighted average, horizon-independent by design)
        sentiment_score = round(0.55 * financial_score + 0.45 * news_score, 1)

        # 6. Quantiles and expected return (horizon-dependent)
        beta = llm_input.get("risk_signals", {}).get("beta") or 1.0
        months = HORIZON_MONTHS.get(horizon, 1)
        expected_return = round((sentiment_score - 50) * 0.15 * months, 2)
        q10 = round(expected_return - beta * 8 * math.sqrt(months), 2)
        q50 = round(expected_return, 2)
        q90 = round(expected_return + beta * 8 * math.sqrt(months), 2)

        # 7. Deterministic confidence score (no LLM involvement)
        confidence_score = self._compute_confidence_score(llm_input, article_count, horizon)

        # 8. LLM qualitative analysis (stance, explanation, drivers, risk flags only)
        llm_result = self._call_llm(llm_input, news_summary, horizon)

        # 9. Assemble full report matching frontend SentimentReport type
        report = {
            "ticker": ticker,
            "companyName": llm_input.get("company_name", ticker),
            "horizon": horizon,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "forecast": {
                "sentimentScore": sentiment_score,
                "expectedReturn": expected_return,
                "quantiles": {"q10": q10, "q50": q50, "q90": q90},
            },
            "risk": {
                "flags": llm_result.get("risk_flags", []),
                "topDrivers": llm_result.get("drivers", []),
                "confidenceScore": confidence_score,
            },
            "narrative": {
                "stance": llm_result.get("stance", "neutral"),
                "explanation": llm_result.get("explanation", ""),
            },
        }

        # 10. Cache in Supabase (expires in 24h)
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        self.supabase.save_sentiment_report({
            "ticker": ticker,
            "horizon": horizon,
            "report": report,
            "stance": llm_result.get("stance", "neutral"),
            "probability_up": sentiment_score,
            "confidence_score": confidence_score,
            "expires_at": expires_at.isoformat(),
        })

        return report

    # ------------------------------------------------------------------ #
    # Scoring helpers                                                      #
    # ------------------------------------------------------------------ #

    def _compute_news_score(self, ticker: str, horizon: str = "1M") -> tuple:
        """
        Fetch recent news from Supabase using a horizon-aware lookback window
        and compute a 0-100 sentiment score.

        Shorter horizons (1D/1W) use only the most recent articles so the score
        reflects immediate market sentiment. Longer horizons (3M/6M) use a wider
        window to capture the broader sentiment arc.

        Falls back to the 20 most recent articles (no date filter) if fewer than
        3 articles are found within the horizon window — preventing an artificially
        neutral score from data sparsity.

        Returns (score, human-readable summary string, article_count).
        """
        lookback_days = HORIZON_LOOKBACK_DAYS.get(horizon, 30)
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=lookback_days)
        from_date = cutoff.strftime("%Y-%m-%d")

        articles = self.supabase.get_recent_articles(ticker=ticker, limit=50, from_date=from_date)

        # Fallback: if the horizon window is too narrow and returns too few articles,
        # use the 20 most recent regardless of date so the score isn't artificially neutral.
        if len(articles) < 3:
            articles = self.supabase.get_recent_articles(ticker=ticker, limit=20)

        if not articles:
            return 50.0, "No recent news available for this ticker.", 0

        positive = sum(1 for a in articles if a.get("sentiment") == "positive")
        negative = sum(1 for a in articles if a.get("sentiment") == "negative")
        neutral_count = len(articles) - positive - negative

        score = 50 + (positive - negative) / len(articles) * 50
        score = round(max(0.0, min(100.0, score)), 1)

        summary = (
            f"{positive} positive, {negative} negative, {neutral_count} neutral "
            f"out of {len(articles)} news articles (last {lookback_days} days)."
        )
        return score, summary, len(articles)

    def _compute_financial_score(self, llm_input: Dict[str, Any]) -> float:
        """
        Deterministic scoring from llm_input growth/risk/valuation signals.
        Base = 50, adjusted by each signal, clamped to [0, 100].
        """
        score = 50.0
        g = llm_input.get("growth_signals", {})
        r = llm_input.get("risk_signals", {})
        v = llm_input.get("valuation_snapshot", {})

        # Revenue growth
        rev_yoy = g.get("revenue_yoy_pct")
        if rev_yoy is not None:
            if rev_yoy > 15:
                score += 25
            elif rev_yoy > 5:
                score += 15
            elif rev_yoy > 0:
                score += 5
            else:
                score -= 15

        # EPS beat
        if g.get("eps_beat"):
            score += 20

        beat_rate = g.get("eps_beat_rate_4q")
        if beat_rate is not None:
            if beat_rate > 0.75:
                score += 15
            elif beat_rate > 0.5:
                score += 10

        eps_surprise = g.get("eps_surprise_pct")
        if eps_surprise is not None and eps_surprise > 5:
            score += 10

        # Valuation
        pe = v.get("pe_ttm")
        if pe is not None:
            if pe < 15:
                score += 10
            elif pe > 40:
                score -= 10

        # Liquidity risk
        current_ratio = r.get("current_ratio")
        if current_ratio is not None and current_ratio < 1:
            score -= 10

        # Leverage risk
        de_ratio = r.get("debt_equity_ratio")
        if de_ratio is not None and de_ratio > 2:
            score -= 10

        # 52-week range position
        range_52w = r.get("52w_range_pct")
        if range_52w is not None:
            if range_52w < 20:
                score += 10  # Near 52w low — potential upside
            elif range_52w > 80:
                score -= 5   # Near 52w high — overbought risk

        return round(max(0.0, min(100.0, score)), 1)

    def _compute_confidence_score(self, llm_input: Dict[str, Any], article_count: int, horizon: str) -> int:
        """
        Deterministic confidence score (50-95). No LLM involvement.

        Factors:
        - News data volume within the horizon window (more articles = higher confidence)
        - EPS beat consistency over last 4 quarters
        - Beta (high volatility = harder to predict = lower confidence)
        - Financial data completeness (missing fields reduce confidence)
        """
        score = 70.0

        # News data quality within the horizon window
        if article_count >= 10:
            score += 10
        elif article_count >= 5:
            score += 5
        elif article_count == 0:
            score -= 10

        # EPS beat consistency
        g = llm_input.get("growth_signals", {})
        beat_rate = g.get("eps_beat_rate_4q")
        if beat_rate is not None:
            if beat_rate > 0.75:
                score += 8
            elif beat_rate >= 0.5:
                score += 3
            else:
                score -= 5

        # Volatility — high beta means more uncertainty
        r = llm_input.get("risk_signals", {})
        beta = r.get("beta")
        if beta is not None:
            if beta > 2.0:
                score -= 15
            elif beta > 1.5:
                score -= 10
            elif beta < 0.8:
                score += 5

        # Financial data completeness
        if g.get("revenue_yoy_pct") is None:
            score -= 5
        if g.get("eps_beat") is None:
            score -= 3
        if llm_input.get("valuation_snapshot", {}).get("pe_ttm") is None:
            score -= 3

        return int(round(max(50, min(95, score))))

    # ------------------------------------------------------------------ #
    # LLM call                                                             #
    # ------------------------------------------------------------------ #

    def _call_llm(self, llm_input: Dict[str, Any], news_summary: str, horizon: str) -> Dict[str, Any]:
        """
        Call Llama 3.1 8B via AI100 for qualitative narrative, drivers, and risk flags.
        Falls back to _fallback_result() if the API is unavailable.
        """
        if not ai100_client.AI100_API_KEY:
            return self._fallback_result(llm_input)

        g = llm_input.get("growth_signals", {})
        r = llm_input.get("risk_signals", {})
        v = llm_input.get("valuation_snapshot", {})

        def fmt(val):
            return val if val is not None else "N/A"

        system = (
            "You are a financial analyst generating investment outlook reports. "
            "Respond using EXACTLY the format specified. Do not add any extra commentary."
        )

        horizon_guidance = HORIZON_GUIDANCE.get(horizon, HORIZON_GUIDANCE["1M"])

        user = f"""Analyze the following financial data for {fmt(llm_input.get('company_name'))} ({fmt(llm_input.get('ticker'))}) and provide an investment outlook for the next {horizon}.

HORIZON GUIDANCE: {horizon_guidance}

FINANCIAL DATA ({fmt(llm_input.get('period_label'))}):
- Revenue YoY Growth: {fmt(g.get('revenue_yoy_pct'))}%
- EPS Beat: {fmt(g.get('eps_beat'))} (Surprise: {fmt(g.get('eps_surprise_pct'))}%)
- EPS Beat Rate (last 4Q): {fmt(g.get('eps_beat_rate_4q'))}
- P/E Ratio (TTM): {fmt(v.get('pe_ttm'))}
- Market Cap: ${fmt(v.get('market_cap_b'))}B
- EV/EBITDA: {fmt(v.get('ev_ebitda'))}
- Current Ratio: {fmt(r.get('current_ratio'))}
- Debt/Equity Ratio: {fmt(r.get('debt_equity_ratio'))}
- Beta: {fmt(r.get('beta'))}
- 52-Week Range Position: {fmt(r.get('52w_range_pct'))}%
- Industry: {fmt(llm_input.get('industry'))}

NEWS SENTIMENT ({horizon} window): {news_summary}

Respond using EXACTLY this format:

STANCE: <bullish or neutral or bearish>
EXPLANATION: <2-3 sentence investment thesis tailored to the {horizon} horizon>
DRIVER_1: <factor name> | <impact score from -1.0 to 1.0> | <one sentence description>
DRIVER_2: <factor name> | <impact score from -1.0 to 1.0> | <one sentence description>
DRIVER_3: <factor name> | <impact score from -1.0 to 1.0> | <one sentence description>
DRIVER_4: <factor name> | <impact score from -1.0 to 1.0> | <one sentence description>
RISK_1: <low or medium or high> | <risk message>
RISK_2: <low or medium or high> | <risk message>

Rules:
- STANCE must be exactly one of: bullish, neutral, bearish
- EXPLANATION must be 2-3 sentences and must reflect the {horizon} time horizon
- Each DRIVER line: factor name, numeric impact (-1.0 to 1.0), description separated by |
- Each RISK line: severity and message separated by |
- Do NOT add any other text"""

        url = f"{ai100_client.AI100_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {ai100_client.AI100_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": ai100_client.AI100_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
            "max_tokens": 800,
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"].get("content", "")
                if content:
                    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                    return self._parse_llm_response(cleaned)
            print(f"[SentimentEngine] LLM returned HTTP {response.status_code}")
        except Exception as e:
            print(f"[SentimentEngine] LLM call failed: {e}")

        return self._fallback_result(llm_input)

    def _parse_llm_response(self, raw: str) -> Dict[str, Any]:
        """Parse the structured plain-text LLM response into a dict."""
        result: Dict[str, Any] = {}

        # Stance
        m = re.search(r"STANCE:\s*(bullish|neutral|bearish)", raw, re.IGNORECASE)
        result["stance"] = m.group(1).lower() if m else "neutral"

        # Explanation
        m = re.search(
            r"EXPLANATION:\s*(.+?)(?=\nDRIVER_|\nRISK_|\nCONFIDENCE:|$)",
            raw, re.DOTALL | re.IGNORECASE,
        )
        result["explanation"] = m.group(1).strip() if m else ""

        # Drivers
        drivers = []
        for i in range(1, 6):
            m = re.search(rf"DRIVER_{i}:\s*(.+?)\|(.+?)\|(.+?)(?=\n|$)", raw, re.IGNORECASE)
            if m:
                try:
                    impact = float(m.group(2).strip())
                except ValueError:
                    impact = 0.0
                drivers.append({
                    "id": f"d{i}",
                    "factor": m.group(1).strip(),
                    "impact": round(max(-1.0, min(1.0, impact)), 2),
                    "description": m.group(3).strip(),
                })
        result["drivers"] = drivers

        # Risk flags
        flags = []
        for i in range(1, 4):
            m = re.search(
                rf"RISK_{i}:\s*(low|medium|high)\s*\|\s*(.+?)(?=\n|$)",
                raw, re.IGNORECASE,
            )
            if m:
                flags.append({
                    "id": f"rf{i}",
                    "severity": m.group(1).lower(),
                    "message": m.group(2).strip(),
                })
        result["risk_flags"] = flags

        return result

    def _fallback_result(self, llm_input: Dict[str, Any]) -> Dict[str, Any]:
        """Return a minimal valid result when LLM is unavailable."""
        g = llm_input.get("growth_signals", {})
        stance = "bullish" if g.get("eps_beat") else "neutral"
        company = llm_input.get("company_name", "This company")
        return {
            "stance": stance,
            "explanation": (
                f"{company} shows {'positive' if stance == 'bullish' else 'mixed'} financial signals "
                f"based on recent earnings data. Full LLM analysis is currently unavailable."
            ),
            "drivers": [],
            "risk_flags": [
                {"id": "rf1", "severity": "medium", "message": "LLM analysis unavailable — using rule-based fallback"}
            ],
            "confidence": 55,
        }

