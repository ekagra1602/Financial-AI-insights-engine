Visualization & Stock Comparison API Detailed Design
Scope: Implements “System shall visualize stock prices using interactive charts” and “System shall allow comparison of multiple stocks on key metrics,” using Finnhub for market data and Qualcomm AI100 for LLM-powered explanations. Aligns with the overall capstone architecture (API Gateway, React web, mobile, Redis cache, Cloud DB) and mirrors the structure of the News Fetch + Summarization + Similar Articles pipeline.

1) Objectives & Non-Goals
Objectives
Real-time stock visualization (intraday & historical) with interactive charts (zoom, pan, range selectors).
Multi-ticker comparison across price/returns and fundamentals (market cap, P/E, EPS, revenue, margins, dividend yield, 52-week metrics, analyst ratings).
LLM-assisted explainers ("What changed today?", “Compare TSLA vs RIVN in one paragraph”), executed on AI100.
Latency-aware delivery via edge/Redis caching and client downsampling.
Non-Goals
No order execution or brokerage connectivity.
No permanent storage of raw tick-level quotes (see Storage Strategy). Optionally store derived aggregates for analytics/backtesting later.

2) Feature Parity with Robinhood-style Dashboard
Quote header: last price, +/- change, % change, open, high, low, previous close, volume.
Interactive chart: intervals 1m/5m/15m/1h/1d; ranges 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX; OHLC/Candles + Volume overlay; crosshair; tooltips.
Fundamentals: market cap, shares outstanding, P/E (TTM), EPS (TTM), revenue, gross/net margin, dividend yield, beta, 52-week high/low.
Corporate info: company profile, sector/industry, country, exchange.
Earnings: next/previous earnings dates, surprise %.
Analyst: rating consensus, target price range.
Comparison tool: add up to N tickers; compare price normalized to 100, total return %, valuation multiples, revenue/EPS trends; toggle axes & scaling.
Insights (LLM on AI100): natural-language summary of drivers, differences, and risks, grounded in retrieved metrics with citations to UI fields.

3) External Data Sources (Finnhub)
Realtime & Historical: quote, candles (resolution=1,5,15,60,D; from/to epoch), stock/profile2, metric (basic & advanced), earnings, recommendation, price-target, peers.
Symbols: stock/symbol, exchange lists.
Rate limits respected with burst protection and token bucket in API Gateway.

4) High-Level Architecture
Clients: React web, Mobile app
API Gateway: auth, rate limit, routing, response compression
Services:
viz-svc: charts & comparison (FastAPI)
metrics-svc: fundamentals/analyst/earnings aggregation (FastAPI)
explain-svc: LLM prompts → explanations (AI100)
Caches/DB:
Redis (TTL) for quotes/candles/profile/metrics responses (keyed by ticker+range+resolution)
Postgres for user prefs, watchlists, comparisons saved, and audit logs
(Optional) Cloud object store for precomputed aggregate snapshots (daily)

5) Storage Strategy 
Do not persist raw, fast-changing quotes. Use Redis TTL cache only (e.g., 5–30s for quote; 2–10 min for 1m/5m candles; 1–24h for daily candles, profiles, and fundamentals). This avoids stale DB copies and reduces cost.
Persist only: user data (watchlists/alerts/comparisons), audit logs, optional derived summaries (e.g., daily normalized return series, factor scores) if we later need backtests or offline analysis.
Historical data requests can be served by Finnhub candles + caching. If we later need low-latency backtests across many tickers, we can add a time-series store (e.g., TimescaleDB) as an optimization—not an MVP requirement.
Pros: simpler system, less storage, compliant with “numbers change every second.”
Cons: heavy reliance on Finnhub SLA; must design resilient caching and graceful degradation.

6) End-to-End Flow (Chart & Compare)


7) API Design (FastAPI)
7.1 Charts
GET /viz/price
Query: symbol (AAPL), range (1D|5D|1M|6M|YTD|1Y|5Y|MAX), res (1|5|15|60|D), adj (bool), normalize (bool), includeVolume (bool)
Response (downsampled for viewport):
{
  "symbol": "AAPL",
  "range": "1M",
  "resolution": 60,
  "series": [{"t": 1730000400, "o": 215.1, "h": 216.0, "l": 214.2, "c": 215.6, "v": 1453200}],
  "stats": {"change": -0.8, "pct": -0.37, "high52w": 237.2, "low52w": 162.4}
}
GET /viz/quote
Returns last price snapshot (for header bar) with ultra-short TTL cache.
GET /viz/peers
Returns peers list from Finnhub for quick compare suggestions.
7.2 Comparison
GET /compare/price
Query: symbols=TSLA,RIVN,NVDA, range, res, normalize=true → returns aligned series, rebased to 100 at start for relative performance.
GET /compare/metrics
Query: symbols, k (comma list: pe,marketCap,epsTTM,revenueTTM,dividendYield,return1Y,beta)
Response: table structure for charts and radar plots.
GET /compare/earnings
Earnings timeline with surprise %, next date.
POST /compare/explain (LLM on AI100)
Body: { "symbols": ["TSLA","RIVN"], "range": "1Y", "metrics": [ ... ], "userPref": {"tone":"neutral"} }
Response: short, grounded narrative with embedded references to displayed fields.
7.3 User Data (persisted in Postgres)
POST/GET/DELETE /user/watchlist
POST/GET/DELETE /user/comparisons (save named comparison views)

8) Caching, Downsampling & Front-End Interactivity
Redis TTL tiers:
quote: 5–30s; candles 1–5m: 2–10m; candles 60m/D: 1–24h; profile/metrics/analyst: 6–24h.
Client-aware downsampling: server computes
Largest-Triangle-Three-Buckets (LTTB) or min/max decimation to ~300–600 points per viewport for smooth charts.
Edge headers: Cache-Control, ETag for CDN friendliness.

9) Error Handling & Degradation
If Finnhub is rate-limited/unavailable: serve stale-while-revalidate from Redis if present; show banner "Realtime temporarily delayed".
Validate symbols; normalize to upper-case; map delisted/OTC gracefully.
Return structured error payloads with machine-readable codes.

10) Security & Compliance
API key management for Finnhub via KMS/Secrets Manager.
User auth via JWT/OAuth; per-user quotas on comparison size.
PII only for auth/watchlists; no trading or sensitive financial advice.



11) LLM Explainability (AI100)
Model: open-source instruction model quantized and compiled for AI100.
Prompt template: inject tabular metrics + normalized return deltas; ask for concise explanation w/ caveats; avoid hallucinations by restricting to provided fields and adding "If unknown, state unknown".
Latency: cache completed explanations for (symbols, range, metrics hash) for 30–120m.

12) Front-End UX Notes (React)
Charts: Recharts/Lightweight-Charts or Highcharts (if license OK). Candles + volume, tooltips, brush for range selection, compare mode toggles, log scale option.
Comparison view: stacked metric table, radar/spider chart for valuation vs growth, normalized performance line chart.
Accessibility: keyboard focus, color-blind palettes, reduced-motion.

13) Performance Targets
P95 /viz/price ≤ 300 ms (cache hit), ≤ 1200 ms (miss + Finnhub fetch).
P95 /compare/metrics ≤ 700 ms (hit), ≤ 1800 ms (miss).
LLM explanation ≤ 1.8 s (cached) / ≤ 4.5 s (fresh) on AI100.

14) Observability & Ops
Metrics: cache hit-rate, per-endpoint latency, Finnhub error/rate-limit counts.
Tracing: API Gateway → svc → Finnhub; include cache spans.
Alerts: sustained hit-rate < 70%, 5xx > 1%, Finnhub quota ≥ 85%.

15) Testing Strategy
Contract tests for each endpoint (schema, required fields).
Golden-file tests for downsampling outputs.
Visual regression for chart tooltips/legends.
LLM prompts unit-tested with deterministic fixtures (temperature=0) + guardrail checks.

16) Future Enhancements
Optional time-series warehouse (TimescaleDB) for backtests/screeners if needed.
Factor views (value/growth/quality), correlation heatmaps.
Portfolio aggregation and risk (beta/volatility) with LLM summaries.

17) Sequence: Comparison Explain (LLM)



18) Example Prompt (AI100)
SYSTEM: You are a financial explainer. Only use the numeric fields provided. If a field is missing, say "unknown"; avoid speculation.
USER: Compare TSLA vs RIVN for range=1Y. Fields: {returns, marketCap, peTTM, revenueTTM, epsTTM, beta, analystConsensus}.
ASSISTANT: A 4–6 sentence neutral summary highlighting return diffs, valuation, size, and risk.



19) Data Retention & Privacy
Redis keys expire automatically; no long-term retention of quotes.
User deletions propagate to watchlists/saved comparisons (GDPR-style erase on request).


MVP Deliverables
/viz/price, /viz/quote, /compare/price, /compare/metrics, /compare/explain endpoints.
React dashboard with chart + comparison view and AI100 insight panel.
Caching, rate limiting, and baseline observability


6) Mapped Component Interactions & Shared Components — Visualization & Stock Comparison API
Component Interactions & Interfaces
Incoming Interfaces (API Endpoints)
User-Facing Endpoints: /api/v1/viz/price, /api/v1/viz/compare, /api/v1/compare/explain -  consume requests from the API Gateway after authentication and rate limiting. These endpoints serve visualization data, comparison metrics, and AI-generated explanations to web and mobile clients.


Internal Endpoints: /internal/viz/cache-refresh and /internal/viz/metrics- accessed by backend services (like News Summarization or Sentiment Analysis) to fetch cached or contextual stock data for enrichment.


Outgoing Interfaces (Dependencies)
Finnhub API: Primary data source for real-time quotes, historical candles, and company fundamentals. The service interacts via REST calls (/quote, /candles, /metric) and uses exponential backoff + caching on failure.


AI100 LLM Engine: Invoked through the shared LLM client to generate textual summaries or explanations for comparisons.


Redis Cache: Stores frequently accessed data (quotes, metrics, profiles) with short TTLs to improve latency and reduce API calls.


PostgreSQL (Shared DB): Stores user-specific configurations such as saved comparisons and watchlists.



Shared Components
To maintain uniformity and reusability across the capstone system, the Visualization API uses shared clients and utilities.
Shared Component
Purpose
Used In
shared.llm_client.LLMInterface
Unified Qualcomm AI100 interaction for generating insights and comparisons.
/compare/explain
shared.cache_client.RedisCache
Shared Redis client maintaining consistent TTL policies and naming conventions.
All endpoints
utils.rate_limiter.RateLimiter
Controls outbound Finnhub API call rate to avoid quota violations.
Finnhub data layer
shared.logger.Logger
Common logging utility for structured and traceable logs.
All modules
shared.metrics.Tracer
Observability layer for distributed tracing and latency tracking.
All service calls
shared.config.ConfigManager
Centralized configuration loader for API keys, provider URLs, and cache rules.
Initialization


Summary
The Visualization & Stock Comparison API follows a modular, pluggable, and fault-tolerant architecture. It can easily swap market data providers (e.g., Polygon.io, Alpha Vantage), recovers gracefully from LLM or data API failures, and maintains uniform shared utilities for cache, rate limiting, and observability, ensuring consistency across all system services.

