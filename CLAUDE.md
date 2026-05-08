# Financial AI Insights Engine — CLAUDE.md

Qualcomm capstone project. Full-stack financial intelligence platform: real-time stock charts, AI-summarized news with pgvector similarity search, sentiment/forecast reports, price-triggered reminders, push notifications, and email alerts.

---

## Running the Project

### Backend
```bash
cd Backend
source venv/bin/activate
uvicorn main:app --reload        # http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Frontend
```bash
cd Frontend
npm install
npm run dev                      # http://localhost:3000
```

### Tests
```bash
cd Backend
python -m pytest tests/test_sentiment.py -v
```
42 tests total: `TestFinancialScore` (18), `TestLLMParsing` (15), `TestNewsScore` (8), plus integration classes that require a live server at `localhost:8000`.

---

## Environment Variables

All required in `Backend/.env` (see `Backend/.env.example`):

| Variable | Purpose |
|---|---|
| `FINNHUB_API_KEY` | Real-time quotes, company metrics, news, financials |
| `SUPABASE_URL` | Postgres + pgvector instance |
| `SUPABASE_KEY` | Supabase service role key |
| `AI100_API_KEY` | Cirrascale AI Suite (LLM + embeddings) |
| `TWELVE_DATA_API_KEY` | OHLCV bar data (1m, 1h, 1d) |
| `RESEND_API_KEY` | Transactional email delivery |
| `AI100_BASE_URL` | Optional override; default `https://aisuite.cirrascale.com/apis/v2` |
| `AI100_MODEL` | Optional override; default `DeepSeek-R1-Distill-Llama-70B` in `ai100_client.py` |

---

## Architecture

```
Frontend (React/Vite :3000)
    │
    └── http://localhost:8000/api/v1/*
            │
        Backend (FastAPI/Uvicorn)
            ├── SQLite (stock_data.db)        — local operational data
            └── Supabase Postgres             — news articles, financial metadata, sentiment reports
```

### Backend File Map

```
Backend/
├── main.py                     — FastAPI app, CORS, router registration
├── database.py                 — SQLite CRUD via sqlite_utils
├── models.py                   — Pydantic models (KeyStatistics)
├── requirements.txt            — No version pins; all latest
├── company_tickers.json        — Static SEC EDGAR ticker list (~10k entries)
├── supabase_schema.sql         — Supabase table definitions (news_articles, financial_metadata, sentiment_reports)
├── vector_setup.sql            — pgvector match_articles RPC function
├── routers/
│   ├── account.py              — Email settings and confirmation
│   ├── news.py                 — Company news, market news, similar-news (pgvector)
│   ├── news_briefing.py        — Toggle/generate morning news briefings
│   ├── notifications.py        — Market event notifications
│   ├── reminders.py            — CRUD + alert endpoints; LLM reminder parsing
│   ├── sentiment.py            — AI sentiment/forecast reports
│   ├── stock_data.py           — OHLCV history endpoint
│   ├── tickers.py              — /companies endpoint (reads company_tickers.json)
│   └── watchlist.py            — Watchlist CRUD + live price enrichment
├── services/
│   ├── ai100_client.py         — Cirrascale LLM client (PRODUCTION)
│   ├── embeddings.py           — AI100 /embeddings endpoint; local numpy fallback (unused in prod)
│   ├── email_service.py        — Resend HTML email sender
│   ├── financial_data_service.py — Finnhub ingestion + LLM input construction
│   ├── finnhub_client.py       — Finnhub API calls AND FastAPI router (/search, /quote)
│   ├── news_processor.py       — Fetch → scrape → AI-analyze → embed → save pipeline
│   ├── notification_service.py — EOD, 2h momentum, morning gap triggers
│   ├── price_monitor.py        — Background asyncio loop for price-based reminder checks
│   ├── reminder_parser.py      — LLM parsing + regex repair of natural language reminders
│   ├── sentiment_engine.py     — Core sentiment/forecast computation engine
│   ├── stock_manager.py        — TwelveData OHLCV fetch + freshness logic
│   └── supabase_client.py      — All Supabase table reads/writes
└── tests/
    ├── __init__.py             — Empty
    └── test_sentiment.py       — 42-test pytest suite
```

---

## Database (Supabase)

All operational data is stored in Supabase Postgres. The `Backend/database.py` module wraps `supabase-py` with a thread-local client (`_get_client()`).

| Table | Purpose |
|---|---|
| `bars_1d` / `bars_1h` / `bars_1m` | TwelveData OHLCV bars |
| `watchlist` | Watched tickers; includes `news_notify_count` |
| `dismissed_notifications` | Dismissed notification IDs |
| `generated_notifications` | Fired notifications with dedup |
| `news_briefing_articles` | Article dedup for sent briefings |
| `user_settings` | Single-row (id=1): email, confirmation, notification toggle |
| `reminders` | User stock reminders |
| `alerts` | Fired alert records |
| `news_articles` | News with embeddings (1024-dim, BAAI/bge-large-en-v1.5) |
| `financial_metadata` | Quarterly/annual financials per ticker |
| `sentiment_reports` | Cached sentiment reports (24h TTL) |
| `stock_event_news` | Cached event-news per (ticker, date) |

`init_db()` does a connectivity check by reading from `user_settings`. Tables are created via `supabase_schema.sql` and `supabase_migration*.sql` run manually in the Supabase SQL editor.

Required env vars: `SUPABASE_URL`, `SUPABASE_KEY` (must be service role key for backend to bypass RLS).

---

## Supabase Schema

| Table | Key columns |
|---|---|
| `news_articles` | `url_hash` (PK, SHA256), `datetime` (BIGINT Unix seconds — NOT ISO string), `embedding` (vector(1024)), `headline`, `summary`, `sentiment`, `tone`, `keywords TEXT[]`, `ticker` |
| `financial_metadata` | PK (`ticker`, `period_type`, `period_key`); JSONB columns for `financials`, `key_metrics`, `eps_data`, `llm_input`; `updated_at` for 7-day freshness check |
| `sentiment_reports` | UUID PK, `ticker`, `horizon`, `report` JSONB, `expires_at` (24h TTL), `generated_at` |

### pgvector
- Embedding model: `BAAI/bge-large-en-v1.5` via AI100 `/embeddings` endpoint — **1024 dimensions**
- Embedding text: `f"{headline} {summary}"` — ticker is intentionally excluded (enables cross-company topic similarity)
- `match_articles` RPC: takes `query_embedding vector(1024)`, uses `<=>` cosine distance operator, returns `1 - distance` as similarity
- `get_recent_articles` converts `from_date` (YYYY-MM-DD string) to Unix timestamp for comparison with the `datetime` BIGINT column

---

## External APIs

### Finnhub (`services/finnhub_client.py`)
`get_finnhub_quote`, `get_finnhub_metric`, `get_finnhub_profile`, `get_finnhub_search`, `get_company_news`, `get_financials_reported`, `get_stock_earnings`, `get_market_news`.

**This file is both a service module and a FastAPI router.** It registers `GET /search` and `GET /quote` directly via its own `APIRouter`. It is mounted bare (no prefix) in `main.py`.

### TwelveData (`services/stock_manager.py`)
Fetches 1m, 1h, 1d OHLCV bars. `DataManager.get_stock_data` applies freshness rules:
- Market open → 5-minute freshness threshold
- Market closed → compare to last market close time
- `_last_failed_attempt` dict enforces 60-second cooldown after rate-limit errors
- Module-level singleton: `manager = DataManager()`

### AI100 / Cirrascale (`services/ai100_client.py`)
**Production LLM client.** Default model: `DeepSeek-R1-Distill-Llama-70B`.

Two core functions:
- `chat_completion(system, user, temp, max_tokens) -> Optional[dict]` — parses JSON response
- `chat_completion_raw(system, user, temp, max_tokens) -> Optional[str]` — returns raw text

Two higher-level functions:
- `analyze_text(text) -> dict` — full news analysis with retry; returns `{sentiment, tone, keywords, summary}`
- `summarize_only(text) -> str` — lightweight 1-2 sentence summary for news briefings

#### Critical AI100 invariants
1. **`tool_choice: "none"` must be in every payload.** Cirrascale/Llama routes JSON-like content through `tool_calls` by default, returning empty `content`. Without this flag, all JSON responses come back empty.
2. **`<think>...</think>` stripping** — applied via `re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)` to every response. DeepSeek R1 outputs reasoning traces inside these tags.

### Supabase (`services/supabase_client.py`)
`get_sentiment_report` uses `datetime.now(datetime.timezone.utc)` (correct, timezone-aware). `financial_data_service.py` still uses `datetime.utcnow()` (deprecated — not yet fixed).

### Resend (`services/email_service.py`)
FROM address: `"Financial Insights <onboarding@resend.dev>"`. Three send functions: `send_notification_email`, `send_confirmation_email`, `send_alert_email`. All silently no-op if email is not configured, not confirmed, or notifications disabled.

---

## Router Registration (`main.py`)

```python
# Bare mounts (no prefix — router defines its own paths or no prefix needed)
app.include_router(finnhub_router)   # provides /search, /quote

# Wrapped in try/except (soft failures at startup)
app.include_router(reminders_router, prefix="/api/v1")
app.include_router(news_router, prefix="/api/v1")
app.include_router(stock_data_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(news_briefing_router, prefix="/api/v1")
app.include_router(tickers_router, prefix="/api/v1")

# Special: account router defines its OWN prefix="/api/v1/account" internally
# So it is included WITHOUT any prefix here
app.include_router(account_router)

# Unconditional — crash at startup if imports fail
app.include_router(sentiment_router, prefix="/api/v1")
```

`ENABLE_PRICE_MONITOR = True` in `main.py` triggers the asyncio background price-monitor task.

---

## Sentiment Engine (`services/sentiment_engine.py`)

### Scoring
- Final sentiment score: `0.55 × financial_score + 0.45 × news_score` (0–100 scale)
- Horizon-aware lookback window for news (1D=1 day, 1W=7 days, 1M=30 days, 3M=90 days, 6M=180 days)
- Confidence score: deterministic formula based on data completeness, article count, score magnitude — does NOT come from the LLM
- `CONFIDENCE:` field IS extracted from LLM output and stored separately (added in Sprint 9 fix)

### Critical `_compute_news_score` contract
The method stores article count as `self._last_article_count` **before returning** and returns only a 2-tuple `(score, summary)`. The caller reads `article_count = getattr(self, "_last_article_count", 0)`. This avoids changing the return signature while sharing data with `_compute_confidence_score`. Any refactor that changes this method's return type will break all 8 `TestNewsScore` tests.

### Async safety
`generate_report` is an async method. The CPU-bound/blocking sub-computations use `asyncio.to_thread` to avoid blocking the event loop.

### Supabase caching
Reports are cached in Supabase `sentiment_reports` with a 24-hour TTL. Frontend adds a 5-minute client-side cache on top. `force_refresh=true` query param bypasses both.

---

## News System

### `news_processor.py` — Fetch/Process Pipeline
1. Check Supabase for ≥5 fresh articles from yesterday → return if found (cache-first)
2. Fetch from Finnhub (`get_company_news`)
3. Scrape full text via `newspaper3k` (browser User-Agent, 10s timeout)
4. AI100 `analyze_text` → sentiment, tone, keywords, summary
5. Embed `f"{headline} {summary}"` via AI100 BAAI/bge-large-en-v1.5
6. Save to Supabase `news_articles`
7. Max 5 articles processed per call

**`_is_relevant` rule:** headline keyword match is sufficient. Keyword match alone OR summary match alone is NOT sufficient — both keyword AND summary must match (in addition to the headline path).

**`_hash_url`:** SHA256 of lowercased URL.

### `routers/news_briefing.py`
News briefing notification ID format: `f"{symbol}_NEWS_{today_str}"` — one briefing per symbol per day regardless of trigger time.

### Similar news (`routers/news.py`)
`GET /news/similar/{url_hash}` fetches the article's embedding from Supabase, generates it on-the-fly if missing, then calls the `match_articles` pgvector RPC.

---

## Reminders & Price Monitor

### Parsing (`services/reminder_parser.py`)
Flow: user text → `parse_reminder` → `chat_completion_raw` → `_parse_ai_response` → `_repair_ai_result`.
- `_repair_ai_result` applies regex fixes: `_parse_relative_time` for time-based conditions, percent detection, ticker normalization
- `_regex_fallback` fires when LLM is unavailable
- `COMPANY_TO_TICKER` dict maps 12 common company names to tickers
- `TICKER_STOPWORDS` set prevents common words (e.g., "AI", "IT") being treated as tickers

### Price Monitor (`services/price_monitor.py`)
- `monitor_loop`: infinite asyncio loop, 300-second interval
- `run_check`: deduplicates tickers, fetches price once per unique ticker, `asyncio.sleep(0.2)` between fetches (Finnhub rate limit protection)
- `check_single_reminder`: fired immediately on reminder creation via `asyncio.create_task` (fire-and-forget)
- Condition types: `price_above`, `price_below`, `percent_change` (uses base price from creation time), `time_based`

### `routers/reminders.py`
`_derive_target_price(current_price, percent_change)` → `round(current_price * (1 + percent_change/100), 2)`. Called at parse time for `percent_change` reminders so the target price is stored.

---

## Notifications

Three market event types in `notification_service.py`:
- `DAILY_EOD` — triggered after 4 PM ET
- `MOMENTUM_2H` — ≥5% move in a 2-hour window (15-min buckets)
- `MORNING_GAP` — triggered after 9:45 AM ET; today's open vs yesterday's close

`NEWS_BRIEFING` and `REMINDER_ALERT` are separate notification types not generated by `notification_service.py`. NEWS_BRIEFING comes from `routers/news_briefing.py`; REMINDER_ALERT is sourced from the `alerts` table.

`GET /notifications` combines market notifications + alert-sourced `REMINDER_ALERT` notifications. Alerts are shown first.

`_format_timestamp_display`: formats ISO string to `"Monday, MM-DD-YYYY HH:MM AM/PM"`.

---

## Financial Data Service (`services/financial_data_service.py`)

### Ingestion
`ingest_ticker` fast-paths if all periods fresh (<7 days). Otherwise fetches from Finnhub: `financials_reported`, `get_stock_earnings`, `get_finnhub_metric`, `get_finnhub_profile`, `get_finnhub_quote`.

### Key calculations
- **FCF** = `operating_cf + capex` — Finnhub reports capex as a negative number, so addition gives the correct FCF
- **52W range position** = `(current_price - low_52w) / (high_52w - low_52w) * 100`, clamped [0, 100]
- **ROA field** = `roa5Y` from Finnhub metric key (`roa_5y` in our schema, not `roa_ttm`)
- **`data_completeness_pct`** computed from 8 key fields; used in LLM prompt and confidence scoring

---

## Frontend

### Routing (`src/router.tsx`)

| Path | Component |
|---|---|
| `/` | `HomePage` |
| `/web-search` | `WebSearch` |
| `/news` | `NewsPage` |
| `/news/:ticker` | `NewsPage` (legacy URL compat) |
| `/chatbot` | `ChatbotPage` |
| `/sentiment-reports` | `SentimentPage` |
| `/reminders` | `RemindersPage` |

All routes are children of `RootLayout`, which provides `Header` + `NotificationProvider` + `NotificationPanel`.

### Key Frontend Architecture Notes

**`NotificationContext`** (`src/context/NotificationContext.tsx`):
- Polls `GET /api/v1/notifications` every 30 seconds
- Triggers news briefing generation on app startup (always)
- Triggers news briefing generation at 10:00 AM ET daily (via 60-second interval check)

**Header** (`src/components/Header.tsx`):
- Polls `GET /api/v1/alerts` every 15 seconds for unread reminder alert badge count
- Shows dropdown of last 10 alerts

**RemindersPage** (`src/pages/RemindersPage.tsx`):
- Polls both reminders and alerts every 15 seconds

**ChatbotPage / Chatbot.tsx**:
- Chatbot is wired to the backend `/api/v1/chat` endpoint via `postChatMessage()`. The fetch URL is constructed from `import.meta.env.VITE_API_BASE_URL` (with a `http://127.0.0.1:8000/api/v1` fallback for local dev). Conversation history is stored in `localStorage` with keys `chatbot_conversations` and `chatbot_messages_{conversationId}`.

**WebSearch.tsx**:
- **Not connected to the backend search endpoint.** Uses static `demoData.ts` for stock results and news results. Wikipedia OpenSearch API is called for suggestions and web-mode fallback. The `/web-search` route shows this component.

### Frontend Caching (`src/services/api.ts`)
- Stock history + stats: 30-second TTL (in-memory Map)
- Sentiment reports: 5-minute TTL (in-memory Map); `forceRefresh=true` bypasses
- Watchlist: `invalidateWatchlistCache()` called on every add/remove/toggle

### Frontend API Base URL
Hardcoded: `const API_BASE_URL = "http://localhost:8000/api/v1"` — no env var.

### Tailwind Design System

| Token | Value | Use |
|---|---|---|
| `background` | `#0d0e0e` | Page background |
| `surface` | `#1b1c1d` | Cards, panels |
| `surface-light` | `#2a2b2c` | Hover states, nested items |
| `border` | `#2a2b2c` | All borders |
| `primary` | `#c3ff2d` | Accent, CTAs (neon yellow-green) |
| `primary-dark` | `#a0cc25` | Pressed/active primary |
| `text-primary` | `#ffffff` | Main text |
| `text-secondary` | `#9ca3af` | Muted text |
| `positive` | `#00c805` | Gains, bullish |
| `negative` | `#ff5000` | Losses, bearish |

### Charting
- **StockChart** uses `react-plotly.js` (Plotly) for OHLCV line charts with area fill, range breaks (weekends + non-trading hours), and 5-minute auto-refresh. Recharts is installed as a dependency but is not used in `StockChart`.
- **Sparkline** is a standalone SVG `<polyline>` component — renders from static data arrays, not connected to live data.

---

## iOS / Capacitor

The iOS app lives in `Frontend/ios/`. Capacitor uses WKWebView to load the Vite build.

**`base: './'` in `vite.config.ts` is required for Capacitor iOS** — without it, WKWebView cannot resolve relative asset paths. This is reflected in the `M Frontend/vite.config.ts` modification on the `ekagra/mobile-application` branch.

---

## Dead Code / Artifacts

| Location | Status |
|---|---|
| `Frontend/src/data/newsData.ts` | Static demo news used as fallback by `NewsPage` keyword-match related articles. |

---

## Test Suite Notes

`Backend/tests/test_sentiment.py`:

**Unit test classes** (no server needed):
- `TestFinancialScore` (18 tests) — mocks Supabase, tests `_compute_financial_score` in isolation
- `TestLLMParsing` (15 tests) — tests `_parse_llm_response` for all field extractions including `CONFIDENCE:`
- `TestNewsScore` (8 tests) — tests `_compute_news_score` returning a 2-tuple `(score, summary)` and storing `self._last_article_count`

**Integration test classes** (require live server at localhost:8000):
- `TestIngestEndpoint`, `TestDataEndpoint`, `TestLLMInputEndpoint`, `TestReportEndpoint`

**Root-level test scripts** (manual use only):
- `Backend/test_db_similarity.py` — evaluates pgvector RPC quality; fetches up to 200 articles from Supabase
- `Backend/test_similarity.py` — single-article similarity check

---

## Common Gotchas

1. **`_compute_news_score` 2-tuple contract** — If you add a return value to this method, you'll break all 8 `TestNewsScore` tests. Use the `self._last_article_count` instance attribute pattern instead.

2. **`tool_choice: "none"` in every AI100 call** — Removing this from any payload will cause the LLM to route responses through `tool_calls`, giving empty `content` on return.

3. **Supabase `datetime` is Unix BIGINT, not ISO string** — `get_recent_articles` does a BIGINT comparison. Do not store or compare ISO strings against this column.

4. **`financial_metadata.updated_at` uses deprecated `utcnow()`** — This is in `financial_data_service.py` and has not been fixed (unlike `supabase_client.py` which uses `datetime.now(datetime.timezone.utc)`).

5. **Account router has its own prefix** — `account.py` defines `router = APIRouter(prefix="/api/v1/account")`. In `main.py` it is included with `app.include_router(account_router)` — no additional prefix. Adding a prefix to the include call will double-prefix all account routes.

6. **Sentiment router is not wrapped in try/except** — A broken import in `routers/sentiment.py` or `services/sentiment_engine.py` will crash the entire server at startup, not just disable that feature.

7. **FCF calculation** — Finnhub reports capital expenditures as a negative number. FCF = `operating_cf + capex` (not subtraction).

8. **News briefing dedup is date-based** — The notification dedup ID is `f"{symbol}_NEWS_{today_str}"`. One briefing per symbol per day is enforced by this key; the time of trigger is irrelevant.

9. **`finnhub_client.py` is dual-role** — It is both a service module (imported by watchlist, reminders, price_monitor, news_processor) AND a FastAPI router (registered in main.py). Do not refactor these apart without updating all consumers.

10. **Capacitor iOS requires `base: './'`** — Without this in `vite.config.ts`, the iOS WKWebView build will fail to load assets.
