"""
Sentiment Forecast Evaluation
==============================
Evaluates forecast accuracy by comparing each horizon's expected_return output
against the stock's actual price movement over the corresponding lookback period.

Methodology (hindcast):
  For a 1M horizon, the model currently predicts +X% over the NEXT 30 days.
  We compare that against the actual return over the PAST 30 days.
  This is valid under the assumption that the model would have given a similar
  prediction 30 days ago — reasonable for large-cap stocks with stable
  fundamentals, weaker for high-volatility names (TSLA, NVDA) where
  fundamentals can shift dramatically in 90+ days.

  This is the simplest practical evaluation without a full historical data
  replay. It is a baseline — not a true backtest.

Metrics:
  MAE                  Mean absolute prediction error (lower is better).
  RMSE                 Penalises large errors more than MAE.
  Directional Accuracy % of cases where predicted direction (up/down) matched actual.
  Stance Accuracy      % of bullish/bearish stances that matched actual direction.
                       Neutral stances are excluded from this metric.
  Within [Q10,Q90]     % of actual returns inside the model's quantile band.
                       Expected to be high (~80-100%) by design; included for
                       completeness but not a sensitive discriminating metric.
  Naive Baseline MAE   MAE if we always predict 0% return.  Used to contextualise
                       the model's MAE — model must beat this to add value.

Usage:
  cd Backend
  source venv/bin/activate
  python evaluate_sentiment.py

Outputs:
  Console summary table + Backend/evaluation_results.json
"""

import datetime
import json
import math
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.sentiment_engine import SentimentEngine
from services.finnhub_client import get_finnhub_quote

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "NVDA", "META", "JPM", "V", "JNJ",
]

# High-volatility tickers where the hindcast assumption is weakest.
HIGH_VOLATILITY = {"TSLA", "NVDA"}

# 1D and 1W have only 1-7 days of history — too short for a meaningful hindcast.
HORIZONS = ["1M", "3M", "6M"]

HORIZON_DAYS = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
}

TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY")
TWELVE_DATA_BASE    = "https://api.twelvedata.com"

# TwelveData free tier: 8 requests/minute.  8s sleep keeps us safely under.
TWELVE_DATA_SLEEP_S = 8


# ---------------------------------------------------------------------------
# Price helpers
# ---------------------------------------------------------------------------

def get_historical_price(ticker: str, days_ago: int) -> Tuple[Optional[float], Optional[str]]:
    """
    Return (close_price, date_str) for the nearest trading day on or before
    `days_ago` calendar days in the past.

    Uses a 10-day lookback window ending at the target date to handle weekends
    and public holidays.  TwelveData returns bars in descending order, so
    values[0] is the most recent bar within the window — the closest available
    trading day to our target.
    """
    target = datetime.date.today() - datetime.timedelta(days=days_ago)
    # Start 10 days before target to cover any holiday clusters.
    start  = target - datetime.timedelta(days=10)

    params = {
        "symbol":     ticker,
        "interval":   "1day",
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date":   target.strftime("%Y-%m-%d"),
        "outputsize": 10,
        "apikey":     TWELVE_DATA_API_KEY,
        "format":     "JSON",
    }

    try:
        resp = requests.get(f"{TWELVE_DATA_BASE}/time_series", params=params, timeout=15)
        data = resp.json()

        if data.get("status") == "error":
            print(f"    TwelveData error for {ticker}: {data.get('message')}")
            return None, None

        values = data.get("values", [])
        if not values:
            return None, None

        # values[0] = most recent bar in the window (descending order).
        bar = values[0]
        return float(bar["close"]), bar["datetime"]

    except Exception as exc:
        print(f"    Historical price fetch failed for {ticker}: {exc}")
        return None, None


def get_current_price(ticker: str) -> Optional[float]:
    """Return the most recent quote price from Finnhub."""
    try:
        quote = get_finnhub_quote(ticker)
        if isinstance(quote, dict):
            price = quote.get("c")
            return float(price) if price else None
    except Exception as exc:
        print(f"    Current price fetch failed for {ticker}: {exc}")
    return None


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def compute_metrics(subset: List[Dict]) -> Dict:
    """
    Compute all aggregate metrics for a list of result dicts.

    Naive baseline MAE: the MAE if the model always predicted 0% return.
    This equals the average absolute actual return, and is the minimum bar
    the model must clear to be useful.
    """
    n = len(subset)
    if n == 0:
        return {}

    mae       = sum(r["abs_error_pct"] for r in subset) / n
    mse       = sum(r["error_pct"] ** 2 for r in subset) / n
    rmse      = math.sqrt(mse)
    dir_acc   = sum(1 for r in subset if r["direction_correct"]) / n * 100
    q_rate    = sum(1 for r in subset if r["within_quantiles"]) / n * 100
    avg_exp   = sum(r["expected_return_pct"] for r in subset) / n
    avg_act   = sum(r["actual_return_pct"] for r in subset) / n

    # Naive baseline: always predict 0%.  Error = |actual_return - 0| = |actual_return|.
    naive_mae = sum(abs(r["actual_return_pct"]) for r in subset) / n

    # Stance accuracy: among non-neutral stances, how often did the
    # bullish/bearish call match the actual price direction?
    opinionated = [r for r in subset if r["stance"] != "neutral"]
    if opinionated:
        stance_correct = sum(
            1 for r in opinionated
            if (r["stance"] == "bullish") == (r["actual_return_pct"] >= 0)
        )
        stance_acc = stance_correct / len(opinionated) * 100
        stance_n   = len(opinionated)
    else:
        stance_acc = None
        stance_n   = 0

    # Confidence-bucketed MAE: split into high (>=75) and low (<75) confidence.
    high_conf = [r for r in subset if r["confidence"] >= 75]
    low_conf  = [r for r in subset if r["confidence"] <  75]
    high_conf_mae = (sum(r["abs_error_pct"] for r in high_conf) / len(high_conf)) if high_conf else None
    low_conf_mae  = (sum(r["abs_error_pct"] for r in low_conf)  / len(low_conf))  if low_conf  else None

    return {
        "n":                      n,
        "mae":                    round(mae, 2),
        "rmse":                   round(rmse, 2),
        "naive_baseline_mae":     round(naive_mae, 2),
        "mae_vs_naive":           round(mae - naive_mae, 2),  # negative = model beats naive
        "directional_accuracy":   round(dir_acc, 1),
        "stance_accuracy":        round(stance_acc, 1) if stance_acc is not None else None,
        "stance_n":               stance_n,
        "within_quantile_pct":    round(q_rate, 1),
        "avg_expected_return":    round(avg_exp, 2),
        "avg_actual_return":      round(avg_act, 2),
        "high_conf_mae":          round(high_conf_mae, 2) if high_conf_mae is not None else None,
        "low_conf_mae":           round(low_conf_mae, 2)  if low_conf_mae  is not None else None,
    }


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

def evaluate():
    engine  = SentimentEngine()
    results: List[Dict] = []
    DIV     = "=" * 84

    print(f"\n{DIV}")
    print("  SENTIMENT FORECAST EVALUATION")
    print(f"  Run date    : {datetime.date.today()}")
    print(f"  Tickers     : {', '.join(TICKERS)}")
    print(f"  Horizons    : {', '.join(HORIZONS)}")
    print(f"  Methodology : hindcast (current model vs past price movement)")
    print(f"  * {', '.join(HIGH_VOLATILITY)} flagged as high-volatility — hindcast assumption is weakest there")
    print(DIV)

    for ticker in TICKERS:
        hv_flag = " [HIGH-VOL]" if ticker in HIGH_VOLATILITY else ""
        print(f"\n{ticker}{hv_flag}")

        current_price = get_current_price(ticker)
        if not current_price:
            print("  No current price — skipping.")
            continue

        for horizon in HORIZONS:
            days_ago = HORIZON_DAYS[horizon]

            # --- Sentiment report (uses 24h Supabase cache when available) ---
            try:
                report          = engine.generate_report(ticker, horizon)
                expected_return = report["forecast"]["expectedReturn"]
                q10             = report["forecast"]["quantiles"]["q10"]
                q90             = report["forecast"]["quantiles"]["q90"]
                sentiment_score = report["forecast"]["sentimentScore"]
                stance          = report["narrative"]["stance"]
                confidence      = report["risk"]["confidenceScore"]
            except Exception as exc:
                print(f"  {horizon}: report generation failed — {exc}")
                continue

            # --- Historical price N days ago via TwelveData ---
            time.sleep(TWELVE_DATA_SLEEP_S)
            hist_price, hist_date = get_historical_price(ticker, days_ago)

            if hist_price is None:
                print(f"  {horizon}: no historical price found — skipping.")
                continue

            # --- Actual return over the lookback window ---
            # Both values are closing prices (historical = daily close from N days
            # ago; current = Finnhub "c" which is last trade/close).
            actual_return = (current_price - hist_price) / hist_price * 100

            # --- Error metrics ---
            error            = expected_return - actual_return
            abs_error        = abs(error)

            # Directional accuracy: does the sign of expected_return match actual?
            # A neutral model (expected_return == 0) is counted as "predicting up",
            # which is the conservative interpretation.
            direction_ok = (expected_return >= 0) == (actual_return >= 0)

            # Quantile coverage: did the actual return land inside [Q10, Q90]?
            within_quantiles = q10 <= actual_return <= q90

            # Implied price check: what price would the model's expected_return
            # imply starting from the historical price?
            implied_current = hist_price * (1 + expected_return / 100)
            implied_error   = current_price - implied_current  # in dollars

            results.append({
                "ticker":              ticker,
                "horizon":             horizon,
                "high_volatility":     ticker in HIGH_VOLATILITY,
                "days_ago":            days_ago,
                "historical_date":     hist_date,
                "historical_price":    round(hist_price, 4),
                "current_price":       round(current_price, 4),
                "implied_current":     round(implied_current, 4),
                "implied_error_usd":   round(implied_error, 2),
                "actual_return_pct":   round(actual_return, 2),
                "expected_return_pct": round(expected_return, 2),
                "error_pct":           round(error, 2),
                "abs_error_pct":       round(abs_error, 2),
                "direction_correct":   direction_ok,
                "within_quantiles":    within_quantiles,
                "q10":                 q10,
                "q90":                 q90,
                "sentiment_score":     sentiment_score,
                "stance":              stance,
                "confidence":          confidence,
            })

            dir_s = "OK  " if direction_ok else "MISS"
            q_s   = "IN"  if within_quantiles else "OUT"
            print(
                f"  {horizon} | "
                f"exp={expected_return:+6.2f}%  actual={actual_return:+6.2f}%  "
                f"err={error:+6.2f}%  dir={dir_s}  Q={q_s}  "
                f"stance={stance:<8} conf={confidence}"
            )

    if not results:
        print("\nNo results collected. Check API keys and that services are reachable.")
        return

    # ---------------------------------------------------------------------------
    # Aggregate metrics by horizon
    # ---------------------------------------------------------------------------

    print(f"\n{DIV}")
    print("  AGGREGATE METRICS BY HORIZON")
    print(f"  Naive baseline = always predict 0% return (model must beat this to add value)")
    print(DIV)

    all_aggregate: Dict = {}

    for horizon in HORIZONS:
        subset = [r for r in results if r["horizon"] == horizon]
        if not subset:
            continue
        m = compute_metrics(subset)
        all_aggregate[horizon] = m

        beats_naive = m["mae_vs_naive"] < 0
        naive_verdict = f"model beats naive by {abs(m['mae_vs_naive']):.2f}%" if beats_naive \
                        else f"naive beats model by {abs(m['mae_vs_naive']):.2f}%"

        print(f"\n  {horizon}  ({m['n']} evaluations, last {HORIZON_DAYS[horizon]} calendar days)")
        print(f"    MAE                        {m['mae']:>7.2f}%")
        print(f"    Naive baseline MAE         {m['naive_baseline_mae']:>7.2f}%    ({naive_verdict})")
        print(f"    RMSE                       {m['rmse']:>7.2f}%")
        print(f"    Directional Accuracy       {m['directional_accuracy']:>7.1f}%   (random = 50%)")
        if m["stance_accuracy"] is not None:
            print(f"    Stance Accuracy            {m['stance_accuracy']:>7.1f}%   ({m['stance_n']} non-neutral stances)")
        print(f"    Within [Q10, Q90]          {m['within_quantile_pct']:>7.1f}%   (band is wide by design)")
        print(f"    Avg expected return        {m['avg_expected_return']:>+7.2f}%")
        print(f"    Avg actual return          {m['avg_actual_return']:>+7.2f}%")
        if m["high_conf_mae"] is not None and m["low_conf_mae"] is not None:
            print(f"    High-confidence MAE (>=75) {m['high_conf_mae']:>7.2f}%")
            print(f"    Low-confidence MAE  (<75)  {m['low_conf_mae']:>7.2f}%")

    # ---------------------------------------------------------------------------
    # Overall aggregate
    # ---------------------------------------------------------------------------

    overall = compute_metrics(results)
    all_aggregate["overall"] = overall

    beats_naive = overall["mae_vs_naive"] < 0
    naive_verdict = f"model beats naive by {abs(overall['mae_vs_naive']):.2f}%" if beats_naive \
                    else f"naive beats model by {abs(overall['mae_vs_naive']):.2f}%"

    print(f"\n{DIV}")
    print("  OVERALL  (all horizons combined)")
    print(DIV)
    print(f"    Evaluations                {overall['n']}")
    print(f"    MAE                        {overall['mae']:>7.2f}%")
    print(f"    Naive baseline MAE         {overall['naive_baseline_mae']:>7.2f}%    ({naive_verdict})")
    print(f"    RMSE                       {overall['rmse']:>7.2f}%")
    print(f"    Directional Accuracy       {overall['directional_accuracy']:>7.1f}%")
    if overall["stance_accuracy"] is not None:
        print(f"    Stance Accuracy            {overall['stance_accuracy']:>7.1f}%   ({overall['stance_n']} non-neutral stances)")
    if overall["high_conf_mae"] is not None and overall["low_conf_mae"] is not None:
        print(f"    High-confidence MAE (>=75) {overall['high_conf_mae']:>7.2f}%")
        print(f"    Low-confidence MAE  (<75)  {overall['low_conf_mae']:>7.2f}%")

    # ---------------------------------------------------------------------------
    # Per-ticker summary
    # ---------------------------------------------------------------------------

    print(f"\n{DIV}")
    print("  PER-TICKER SUMMARY  (MAE averaged across all horizons)")
    print(DIV)
    print(f"  {'Ticker':<8} {'Evals':>5} {'MAE':>8} {'Naive MAE':>10} {'Dir Acc':>8} {'High-Vol':<10}")
    print("  " + "-" * 55)
    for ticker in TICKERS:
        ts = [r for r in results if r["ticker"] == ticker]
        if not ts:
            continue
        tm    = compute_metrics(ts)
        hv    = "YES" if ticker in HIGH_VOLATILITY else ""
        beats = "<" if tm["mae"] < tm["naive_baseline_mae"] else ">"
        print(
            f"  {ticker:<8} {tm['n']:>5} {tm['mae']:>7.2f}%  "
            f"{tm['naive_baseline_mae']:>8.2f}%  {tm['directional_accuracy']:>7.1f}%  {hv}"
        )

    # ---------------------------------------------------------------------------
    # Detailed results table
    # ---------------------------------------------------------------------------

    print(f"\n{DIV}")
    print("  DETAILED RESULTS")
    print(f"  Implied price = hist_price x (1 + expected_return/100)")
    print(f"  Implied error = actual_current_price - implied_current_price")
    print(DIV)

    hdr = (
        f"  {'Ticker':<7} {'H':<4} {'Exp%':>8} {'Act%':>8} {'Err%':>7}  "
        f"{'Dir':<5} {'Q':<4} {'Impl $Err':>10} {'Stance':<10} {'Conf':>5}"
    )
    print(hdr)
    print("  " + "-" * 80)

    for r in results:
        hv   = "*" if r["high_volatility"] else " "
        dir_s = "OK"   if r["direction_correct"] else "MISS"
        q_s   = "IN"   if r["within_quantiles"]  else "OUT"
        print(
            f"  {r['ticker']:<6}{hv} {r['horizon']:<4} "
            f"{r['expected_return_pct']:>+7.2f}% {r['actual_return_pct']:>+7.2f}% "
            f"{r['error_pct']:>+6.2f}%  {dir_s:<5} {q_s:<4} "
            f"{r['implied_error_usd']:>+9.2f}  {r['stance']:<10} {r['confidence']:>5}"
        )

    print(f"\n  * = high-volatility ticker; hindcast assumption is weakest for these")

    # ---------------------------------------------------------------------------
    # Save JSON
    # ---------------------------------------------------------------------------

    out_path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    with open(out_path, "w") as fh:
        json.dump({
            "run_date":   datetime.date.today().isoformat(),
            "tickers":    TICKERS,
            "horizons":   HORIZONS,
            "methodology": (
                "Hindcast: sentiment reports generated with current financial data "
                "are compared against actual price movement over the corresponding "
                "past window (e.g., 30 days for 1M). Valid under the assumption "
                "that fundamentals were similar N days ago. Assumption is weakest "
                f"for high-volatility tickers: {sorted(HIGH_VOLATILITY)}."
            ),
            "aggregate":  all_aggregate,
            "results":    results,
        }, fh, indent=2)

    print(f"\n  Results saved to {out_path}")
    print(f"{DIV}\n")


if __name__ == "__main__":
    evaluate()
