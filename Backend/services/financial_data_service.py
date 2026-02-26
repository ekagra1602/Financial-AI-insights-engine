# for last 15 days or so
# create a 30 day vector and pass everything for everyday
# build a minimal effort pipeline

import datetime
from typing import Optional, List, Dict, Any

from services.finnhub_client import (
    get_financials_reported,
    get_stock_earnings,
    get_finnhub_metric,
    get_finnhub_profile,
)
from services.supabase_client import SupabaseClient


class FinancialDataService:
    """
    Fetches financial data from Finnhub, normalizes it, stores in Supabase,
    and assembles structured LLM inputs for downstream sentiment generation.
    Mirrors the NewsProcessor pattern.
    """

    def __init__(self):
        self.supabase = SupabaseClient()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def ingest_ticker(
        self,
        ticker: str,
        period_type: str = "quarterly",
        num_periods: int = 4,
    ) -> Dict[str, Any]:
        """
        Main entry point. Fetches Finnhub data, normalizes, stores, and returns
        a summary of what was ingested.
        """
        ticker = ticker.upper()
        result = {
            "ticker": ticker,
            "periods_processed": 0,
            "periods_cached": 0,
            "period_keys": [],
            "status": "success",
            "errors": []
        }

        # Fetch all three Finnhub sources
        try:
            raw_financials = get_financials_reported(ticker, freq=period_type)
        except Exception as e:
            raw_financials = {}
            result["errors"].append(f"financials-reported: {str(e)}")

        try:
            raw_earnings = get_stock_earnings(ticker)
        except Exception as e:
            raw_earnings = []
            result["errors"].append(f"earnings: {str(e)}")

        try:
            raw_metrics = get_finnhub_metric(ticker)
        except Exception as e:
            raw_metrics = {}
            result["errors"].append(f"metric: {str(e)}")

        try:
            raw_profile = get_finnhub_profile(ticker)
        except Exception as e:
            raw_profile = {}
            result["errors"].append(f"profile: {str(e)}")

        # Extract list of reported periods (newest first), capped at num_periods
        reports = raw_financials.get("data", [])
        reports = reports[:num_periods]

        if not reports:
            result["status"] = "error" if result["errors"] else "no_data"
            result["errors"].append("No financial report periods returned from Finnhub.")
            return result

        # Build earnings lookup keyed by period string e.g. "2024-Q3"
        earnings_lookup = self._build_earnings_lookup(
            raw_earnings if isinstance(raw_earnings, list) else []
        )

        # Normalize key_metrics snapshot (same across all periods — frozen at ingest time)
        key_metrics = self._normalize_key_metrics(raw_metrics.get("metric", {}))

        # Process each period
        for report in reports:
            period_key, period_meta = self._extract_period_meta(report, period_type)
            if not period_key:
                continue

            # Cache check: skip if stored and fresh (< 7 days old)
            cached = self.supabase.get_financial_period(ticker, period_type, period_key)
            if cached:
                age = self._age_days(cached.get("updated_at"))
                if age < 7:
                    result["periods_cached"] += 1
                    result["period_keys"].append(period_key)
                    continue

            financials = self._normalize_financials(report)
            eps_data = self._build_eps_data(period_key, earnings_lookup)

            # Pass period_type into meta for llm_input
            period_meta["period_type"] = period_type

            llm_input = self._build_llm_input(
                ticker=ticker,
                profile=raw_profile,
                period_meta=period_meta,
                financials=financials,
                key_metrics=key_metrics,
                eps_data=eps_data,
            )

            record = {
                "ticker": ticker,
                "period_type": period_type,
                "period_key": period_key,
                "fiscal_year": period_meta.get("fiscal_year"),
                "fiscal_quarter": period_meta.get("fiscal_quarter"),
                "period_end_date": period_meta.get("period_end_date"),
                "financials": financials,
                "key_metrics": key_metrics,
                "eps_data": eps_data,
                "llm_input": llm_input,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            }

            self.supabase.save_financial_metadata(record)
            result["periods_processed"] += 1
            result["period_keys"].append(period_key)

        if result["errors"]:
            result["status"] = "partial" if result["periods_processed"] > 0 else "error"

        return result

    def get_ticker_data(
        self,
        ticker: str,
        period_type: str = None,
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """Retrieve stored financial metadata rows for a ticker from Supabase."""
        return self.supabase.get_financial_metadata(ticker.upper(), period_type, limit)

    def get_latest_llm_input(
        self,
        ticker: str,
        period_type: str = "quarterly"
    ) -> Optional[Dict[str, Any]]:
        """
        Returns just the llm_input from the most recent stored period.
        Primary output consumed by Sprint 8/9 sentiment generation.
        """
        rows = self.supabase.get_financial_metadata(ticker.upper(), period_type, limit=1)
        if rows:
            return rows[0].get("llm_input")
        return None

    # ------------------------------------------------------------------ #
    # Private normalization helpers                                        #
    # ------------------------------------------------------------------ #

    def _extract_period_meta(self, report: Dict[str, Any], period_type: str) -> tuple:
        """
        Extract (period_key, period_meta_dict) from a Finnhub financials-reported item.
        Finnhub shape: { "year": 2024, "quarter": 3, "endDate": "2024-09-28", ... }
        """
        try:
            year = report.get("year")
            quarter = report.get("quarter", 0)
            end_date = report.get("endDate") or report.get("startDate")

            if not year:
                return None, {}

            if period_type == "quarterly" and quarter:
                period_key = f"{year}-Q{quarter}"
                label = f"Q{quarter} FY{year}"
            else:
                period_key = f"{year}-FY"
                label = f"FY{year}"

            period_meta = {
                "fiscal_year":    year,
                "fiscal_quarter": quarter if quarter else None,
                "period_end_date": end_date,
                "period_label":   label,
            }
            return period_key, period_meta
        except Exception as e:
            print(f"Error extracting period meta: {e}")
            return None, {}

    def _normalize_financials(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Finnhub's nested report.report XBRL structure to our flat financials shape.
        Each statement section (ic/bs/cf) is a list of {concept, label, unit, value} items.
        Uses a multi-key safe() helper to handle XBRL concept name variance across companies.
        """
        def items_to_dict(items: list) -> dict:
            if not items:
                return {}
            return {item["concept"]: item.get("value") for item in items if "concept" in item}

        raw = report.get("report", {})
        ic = items_to_dict(raw.get("ic", []))
        bs = items_to_dict(raw.get("bs", []))
        cf = items_to_dict(raw.get("cf", []))

        def safe(d, *keys):
            for key in keys:
                val = d.get(key)
                if val is not None:
                    return val
            return None

        revenue = safe(ic,
            "Revenues",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "SalesRevenueNet",
            "RevenueFromContractWithCustomerIncludingAssessedTax",
        )
        gross_profit = safe(ic, "GrossProfit")
        operating_income = safe(ic, "OperatingIncomeLoss")
        da = safe(ic, "DepreciationDepletionAndAmortization", "DepreciationAndAmortization")

        income_statement = {
            "revenue":          revenue,
            "gross_profit":     gross_profit,
            "operating_income": operating_income,
            "net_income":       safe(ic, "NetIncomeLoss", "ProfitLoss"),
            "ebitda":           (operating_income + da) if (operating_income is not None and da is not None) else None,
            "eps_basic":        safe(ic, "EarningsPerShareBasic"),
            "eps_diluted":      safe(ic, "EarningsPerShareDiluted"),
            "shares_basic":     safe(ic, "WeightedAverageNumberOfSharesOutstandingBasic"),
            "shares_diluted":   safe(ic, "WeightedAverageNumberOfDilutedSharesOutstanding"),
            "rd_expense":       safe(ic, "ResearchAndDevelopmentExpense"),
            "sga_expense":      safe(ic, "SellingGeneralAndAdministrativeExpense"),
        }

        operating_cf = safe(cf, "NetCashProvidedByUsedInOperatingActivities")
        capex = safe(cf,
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "CapitalExpendituresIncurredButNotYetPaid",
        )
        free_cash_flow = (operating_cf + capex) if (operating_cf is not None and capex is not None) else None

        balance_sheet = {
            "total_assets":           safe(bs, "Assets"),
            "total_liabilities":      safe(bs, "Liabilities"),
            "total_equity":           safe(bs, "StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
            "cash_and_equivalents":   safe(bs, "CashAndCashEquivalentsAtCarryingValue"),
            "short_term_investments": safe(bs, "MarketableSecuritiesCurrent", "ShortTermInvestments"),
            "total_debt":             safe(bs, "LongTermDebtAndCapitalLeaseObligations"),
            "long_term_debt":         safe(bs, "LongTermDebt", "LongTermDebtNoncurrent"),
            "current_assets":         safe(bs, "AssetsCurrent"),
            "current_liabilities":    safe(bs, "LiabilitiesCurrent"),
        }

        cash_flow = {
            "operating_cash_flow": operating_cf,
            "investing_cash_flow": safe(cf, "NetCashProvidedByUsedInInvestingActivities"),
            "financing_cash_flow": safe(cf, "NetCashProvidedByUsedInFinancingActivities"),
            "free_cash_flow":      free_cash_flow,
            "capex":               capex,
            "dividends_paid":      safe(cf, "PaymentsOfDividends"),
        }

        return {
            "income_statement": income_statement,
            "balance_sheet":    balance_sheet,
            "cash_flow":        cash_flow,
            "source_report_id": report.get("id"),
            "filing_date":      report.get("filedDate"),
        }

    def _normalize_key_metrics(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Finnhub's flat metric dict to our structured key_metrics shape.
        Reuses the same dict returned by get_finnhub_metric() under ["metric"].
        """
        def s(key):
            return raw.get(key)

        return {
            "valuation": {
                "pe_ttm":     s("peTTM"),
                "pe_forward": s("peForward"),
                "pb_ratio":   s("pbQuarterly"),
                "ps_ratio":   s("psTTM"),
                "ev_ebitda":  s("evEbitdaTTM"),
                "ev_revenue": s("evRevenueTTM"),
            },
            "profitability": {
                "gross_margin_ttm":     s("grossMarginTTM"),
                "operating_margin_ttm": s("operatingMarginTTM"),
                "net_margin_ttm":       s("netProfitMarginTTM"),
                "roa_ttm":              s("roa5Y"),
                "roe_ttm":              s("roeTTM"),
                "roic_ttm":             s("roicTTM"),
            },
            "growth": {
                "revenue_growth_3y":  s("revenueGrowth3Y"),
                "eps_growth_3y":      s("epsGrowth3Y"),
                "revenue_growth_ttm": s("revenueGrowthTTMYoy"),
                "eps_growth_ttm":     s("epsGrowthTTMYoy"),
            },
            "liquidity": {
                "current_ratio":     s("currentRatioQuarterly"),
                "quick_ratio":       s("quickRatioQuarterly"),
                "debt_equity_ratio": s("totalDebt/totalEquityQuarterly"),
                "interest_coverage": s("netInterestCoverageQuarterly"),
            },
            "market": {
                "market_cap":    s("marketCapitalization"),
                "52_week_high":  s("52WeekHigh"),
                "52_week_low":   s("52WeekLow"),
                "beta":          s("beta"),
                "dividend_yield": s("dividendYieldIndicatedAnnual"),
            },
        }

    def _build_earnings_lookup(self, raw_earnings: list) -> Dict[str, Any]:
        """
        Convert Finnhub earnings list to a lookup keyed by '2024-Q3' format.
        Finnhub earnings item: {"actual": 1.46, "estimate": 1.41, "quarter": 3, "year": 2024, ...}
        """
        lookup = {}
        for item in raw_earnings:
            year = item.get("year")
            quarter = item.get("quarter")
            if not year or not quarter:
                continue
            key = f"{year}-Q{quarter}"
            actual = item.get("actual")
            estimate = item.get("estimate")
            surprise = None
            surprise_pct = None
            if actual is not None and estimate is not None and estimate != 0:
                surprise = round(actual - estimate, 4)
                surprise_pct = round((surprise / abs(estimate)) * 100, 2)
            lookup[key] = {
                "actual":       actual,
                "estimate":     estimate,
                "surprise":     surprise,
                "surprise_pct": surprise_pct,
                "beat":         (actual > estimate) if (actual is not None and estimate is not None) else None,
            }
        return lookup

    def _build_eps_data(self, period_key: str, earnings_lookup: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assemble eps_data for a specific period: current beat/miss + trailing 4Q stats.
        """
        current = earnings_lookup.get(period_key, {})
        all_keys = sorted(earnings_lookup.keys(), reverse=True)[:4]
        trailing = []
        for k in all_keys:
            e = earnings_lookup[k]
            trailing.append({
                "period":       k,
                "actual":       e.get("actual"),
                "estimate":     e.get("estimate"),
                "surprise_pct": e.get("surprise_pct"),
                "beat":         e.get("beat"),
            })

        beats = [t["beat"] for t in trailing if t["beat"] is not None]
        surprises = [t["surprise_pct"] for t in trailing if t["surprise_pct"] is not None]

        return {
            "current_period":    current,
            "trailing_quarters": trailing,
            "beat_rate_4q":      round(sum(beats) / len(beats), 3) if beats else None,
            "avg_surprise_pct_4q": round(sum(surprises) / len(surprises), 2) if surprises else None,
        }

    def _build_llm_input(
        self,
        ticker: str,
        profile: Dict[str, Any],
        period_meta: Dict[str, Any],
        financials: Dict[str, Any],
        key_metrics: Dict[str, Any],
        eps_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Assemble the structured LLM input JSON — the pre-computed context block
        passed directly to the sentiment LLM in Sprints 8 and 9.
        """
        ic  = financials.get("income_statement", {})
        bs  = financials.get("balance_sheet", {})
        cf  = financials.get("cash_flow", {})
        val = key_metrics.get("valuation", {})
        liq = key_metrics.get("liquidity", {})
        mkt = key_metrics.get("market", {})
        grw = key_metrics.get("growth", {})

        # 52-week range as a percentage span
        high_52w = mkt.get("52_week_high")
        low_52w  = mkt.get("52_week_low")
        range_52w_pct = None
        if high_52w and low_52w and low_52w != 0:
            range_52w_pct = round(((high_52w - low_52w) / low_52w) * 100, 1)

        market_cap = mkt.get("market_cap")
        market_cap_b = round(market_cap / 1000, 2) if market_cap else None

        # Data completeness score
        key_fields = [
            ic.get("revenue"), ic.get("net_income"), ic.get("eps_diluted"),
            bs.get("total_assets"), bs.get("total_equity"),
            cf.get("operating_cash_flow"), cf.get("free_cash_flow"),
            eps_data.get("current_period", {}).get("actual"),
        ]
        non_null = sum(1 for f in key_fields if f is not None)
        completeness_pct = round((non_null / len(key_fields)) * 100, 1)

        return {
            "ticker":       ticker,
            "company_name": profile.get("name", ticker),
            "industry":     profile.get("finnhubIndustry", "Unknown"),
            "period_label": period_meta.get("period_label", ""),
            "period_type":  period_meta.get("period_type", "quarterly"),
            "as_of_date":   financials.get("filing_date") or datetime.date.today().isoformat(),

            "financial_snapshot": {
                "revenue_m":          ic.get("revenue"),
                "gross_margin_pct":   self._safe_pct(ic.get("gross_profit"), ic.get("revenue")),
                "operating_income_m": ic.get("operating_income"),
                "net_income_m":       ic.get("net_income"),
                "eps_diluted":        ic.get("eps_diluted"),
                "free_cash_flow_m":   cf.get("free_cash_flow"),
                "cash_m":             bs.get("cash_and_equivalents"),
                "total_debt_m":       bs.get("total_debt"),
            },

            "valuation_snapshot": {
                "pe_ttm":       val.get("pe_ttm"),
                "ev_ebitda":    val.get("ev_ebitda"),
                "ps_ratio":     val.get("ps_ratio"),
                "market_cap_b": market_cap_b,
            },

            "growth_signals": {
                "revenue_yoy_pct":  grw.get("revenue_growth_ttm"),
                "eps_beat":         eps_data.get("current_period", {}).get("beat"),
                "eps_surprise_pct": eps_data.get("current_period", {}).get("surprise_pct"),
                "eps_beat_rate_4q": eps_data.get("beat_rate_4q"),
            },

            "risk_signals": {
                "debt_equity_ratio": liq.get("debt_equity_ratio"),
                "current_ratio":     liq.get("current_ratio"),
                "beta":              mkt.get("beta"),
                "52w_range_pct":     range_52w_pct,
            },

            "quality_flags": {
                "has_income_statement": bool(ic.get("revenue")),
                "has_balance_sheet":    bool(bs.get("total_assets")),
                "has_cash_flow":        bool(cf.get("operating_cash_flow")),
                "has_eps_history":      bool(eps_data.get("trailing_quarters")),
                "data_completeness_pct": completeness_pct,
            },
        }

    # ------------------------------------------------------------------ #
    # Utility helpers                                                      #
    # ------------------------------------------------------------------ #

    def _safe_pct(self, numerator, denominator) -> Optional[float]:
        if numerator is None or denominator is None or denominator == 0:
            return None
        return round((numerator / denominator) * 100, 2)

    def _age_days(self, updated_at_str: Optional[str]) -> float:
        if not updated_at_str:
            return 999.0
        try:
            updated_at = datetime.datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
            now = datetime.datetime.now(datetime.timezone.utc)
            return (now - updated_at).total_seconds() / 86400
        except Exception:
            return 999.0
