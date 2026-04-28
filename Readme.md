# Qualcomm AI Financial Insights Engine

A full-stack financial intelligence platform powered by **Qualcomm AI100** (via Cirrascale AI Suite). It combines real-time market data, AI-driven news analysis, natural-language reminders, an LLM-grounded fundamental sentiment engine, push notifications, an interactive AI chatbot, and rich charting in a single dashboard. The frontend ships as both a web app and native mobile apps (iOS / Android) via Capacitor.

---

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [How `start.sh` Works](#how-startsh-works)
- [Manual Setup](#manual-setup-alternative)
- [Docker Compose](#docker-compose)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [API Reference](#api-reference)
- [Database & Schema](#database--schema)
- [Background Jobs](#background-jobs)
- [Testing](#testing)
- [Mobile (Capacitor)](#mobile-capacitor)
- [Prerequisites](#prerequisites)
- [Troubleshooting](#troubleshooting)
- [Contributing & License](#contributing--license)

---

## Highlights

- **Real-time + historical market data** — Finnhub for live quotes & profiles, TwelveData for historical OHLCV.
- **AI-summarized news** — newspaper3k scraping, Qualcomm AI100 LLM summaries, sentiment, and keyword extraction.
- **Sentiment Engine** — multi-period (1D / 1W / 1M / 3M / 6M) qualitative + quantitative sentiment reports built from ingested Finnhub financials, news scoring, and an LLM analysis pass. Reports are cached in Supabase for 24h.
- **Natural-language Reminders + Alerts** — type *"Alert me when AAPL drops below $170"* and the LLM extracts ticker, condition, target. A background price monitor evaluates conditions and fires alerts.
- **Unified Notifications** — market-move pings, daily morning news briefings (10 AM ET), and triggered reminders merged into one panel; opt-in email delivery via Resend.
- **AI Chatbot** — multi-turn finance assistant with conversation history, ELI5 mode, optional news grounding, and voice input via the Web Speech API.
- **Interactive charts** — Recharts + Plotly with chart-event annotations sourced from per-date news.
- **Cross-platform** — same React codebase ships as web (Vite), iOS, and Android via Capacitor.

---

## Architecture

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  React + Vite Frontend   │ ◄───► │   FastAPI Backend        │
│  (web / iOS / Android)   │  REST │   (Uvicorn, Pydantic)    │
└──────────────────────────┘       └────────────┬─────────────┘
                                                │
        ┌───────────────────────────────────────┼────────────────────────────────┐
        ▼                       ▼               ▼                ▼               ▼
   Finnhub API           TwelveData API    Cirrascale         Supabase        Resend
   (quotes / news /      (OHLCV history)   AI Suite           (Postgres:      (email
    financials /                            (Qualcomm          watchlist,      delivery)
    search)                                  AI100 LLM)        reminders,
                                                               alerts, news,
                                                               sentiment,
                                                               financials,
                                                               notifications)
```

A background `price_monitor` task (opt-in via flag in `main.py`) polls active reminders against Finnhub quotes and writes triggered alerts into Supabase, which the frontend pulls on a poll interval.

---

## Project Structure

```
qualcomm-financial-insights-engine/
├── Backend/                                # Python FastAPI service
│   ├── main.py                             # App entry, CORS, router registration, startup hooks
│   ├── database.py                         # Supabase data-access layer (watchlist, reminders, alerts, …)
│   ├── models.py                           # Pydantic models
│   ├── requirements.txt                    # Python dependencies
│   ├── pytest.ini                          # Pytest config
│   ├── Dockerfile                          # Backend container
│   ├── company_tickers.json                # Static SEC ticker/company list
│   ├── stock_data.db                       # Local SQLite cache (history loader)
│   ├── supabase_schema.sql                 # Base Supabase schema
│   ├── supabase_migration.sql              # Schema migrations
│   ├── supabase_migration_stock_event_news.sql
│   ├── vector_setup.sql                    # pgvector extension setup for news similarity
│   ├── routers/
│   │   ├── account.py                      # Email confirmation / notification toggle
│   │   ├── chat.py                         # AI chatbot with news grounding & ELI5 mode
│   │   ├── event_news.py                   # Per-date event annotations on charts
│   │   ├── news.py                         # AI-summarized company / market news
│   │   ├── news_briefing.py                # Daily 10 AM ET morning briefings
│   │   ├── notifications.py                # Unified notification feed + dismiss
│   │   ├── reminders.py                    # NL parsing + reminder/alert CRUD
│   │   ├── sentiment.py                    # Sentiment engine ingest/data/report
│   │   ├── stock_data.py                   # Historical OHLCV + chart events
│   │   ├── tickers.py                      # Static company list (SEC tickers)
│   │   └── watchlist.py                    # Watchlist CRUD with live price enrichment
│   └── services/
│       ├── ai100_client.py                 # Cirrascale / AI100 LLM client
│       ├── chart_events.py                 # Compute price events from OHLCV + news
│       ├── email_service.py                # Resend email delivery
│       ├── embeddings.py                   # Sentence-transformers vector embeddings
│       ├── event_news_service.py           # Lazy event-news cache + Finnhub fetch
│       ├── financial_data_service.py       # Finnhub financials → normalized Supabase rows
│       ├── finnhub_client.py               # Finnhub REST wrapper + /quote /search router
│       ├── history_loader.py               # OHLCV loader (TwelveData + SQLite cache)
│       ├── news_processor.py               # News scrape, summarize, embed, dedupe
│       ├── notification_service.py         # Aggregates market-move + briefing notifications
│       ├── price_monitor.py                # Background loop checking active reminders
│       ├── prompt_router.py                # Classify chat prompts (news / quote / general)
│       ├── reminder_parser.py              # LLM parser with regex fast-path + fallback
│       ├── sentiment_engine.py             # Builds sentiment reports (financials + news + LLM)
│       ├── stock_manager.py                # Higher-level stock data orchestration
│       └── supabase_client.py              # Supabase client singleton
│
├── Frontend/                               # React + TypeScript + Vite (also Capacitor)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.tsx                # Dashboard: watchlist, charts, company stats
│   │   │   ├── NewsPage.tsx                # Market & per-ticker news feed
│   │   │   ├── ChatbotPage.tsx             # AI chat with history sidebar + voice
│   │   │   ├── RemindersPage.tsx           # NL reminder authoring + alerts panel
│   │   │   └── SentimentPage.tsx           # Sentiment engine UI (ingest + report)
│   │   ├── components/
│   │   │   ├── StockChart.tsx              # Multi-period interactive chart (Recharts/Plotly)
│   │   │   ├── CompanyStats.tsx            # Key-stats panel
│   │   │   ├── Header.tsx                  # Top nav with notification bell
│   │   │   ├── NotificationPanel.tsx       # Unified notifications dropdown
│   │   │   ├── AccountModal.tsx            # Email + notification settings modal
│   │   │   ├── Chatbot.tsx                 # Chat surface
│   │   │   ├── ChatHistorySidebar.tsx      # Persistent chat sessions
│   │   │   ├── NewsFeed.tsx                # News list view
│   │   │   ├── SentimentHome.tsx           # Sentiment landing
│   │   │   ├── SentimentContainer.tsx      # Orchestrates ingest → report flow
│   │   │   ├── SentimentReport.tsx         # Renders horizon report + scores
│   │   │   ├── Sparkline.tsx               # Inline trend chart for watchlist rows
│   │   │   ├── WebSearch.tsx               # Symbol search experience
│   │   │   ├── EmptyState.tsx, ErrorMessage.tsx, LoadingSpinner.tsx, SkeletonLoader.tsx
│   │   │   ├── news/        # NewsCard, RelatedArticles
│   │   │   ├── reminders/   # ReminderInput, ReminderList, AlertsPanel
│   │   │   └── __tests__/   # Vitest component tests
│   │   ├── context/NotificationContext.tsx # Global notification state
│   │   ├── layouts/RootLayout.tsx          # App shell
│   │   ├── services/api.ts                 # Typed backend API client
│   │   ├── data/                           # Demo / fallback data
│   │   ├── types.ts                        # Shared TS interfaces
│   │   ├── router.tsx                      # React Router v6 routes
│   │   ├── main.tsx, index.css, global.d.ts
│   │   └── __tests__/                      # MSW handlers + setup
│   ├── e2e/                                # Playwright behavioral suite
│   ├── android/, ios/                      # Capacitor native projects
│   ├── public/                             # Static assets (Qualcomm logo, …)
│   ├── playwright.config.ts                # Playwright config (Chromium, port 3000)
│   ├── vitest.config.ts                    # Vitest unit-test config
│   ├── capacitor.config.ts                 # Capacitor config
│   ├── tailwind.config.js, postcss.config.js
│   ├── tsconfig.json, vite.config.ts
│   └── Dockerfile                          # Frontend container
│
├── docker-compose.yml                      # Compose for backend + frontend
├── start.sh                                # One-command local dev
├── docs/
└── Readme.md
```

---

## Quick Start

```bash
./start.sh
```

That single command boots backend + frontend in one terminal and shuts both down cleanly on `Ctrl+C`. See [How `start.sh` Works](#how-startsh-works).

---

## How `start.sh` Works

`start.sh` orchestrates a complete local dev stack in one shell.

1. **Port cleanup** — kills any process bound to `:8000` so the backend can rebind cleanly.
2. **Backend startup**
   - `cd Backend`
   - Creates a Python `venv` if it doesn't exist
   - Activates the virtual environment
   - `pip install -q -r requirements.txt` (idempotent — fast on subsequent runs)
   - `uvicorn main:app --reload --port 8000` in the background
3. **Frontend startup**
   - `cd Frontend`
   - `npm install` (idempotent)
   - `npm run dev` in the background
4. **Graceful shutdown** — `trap SIGINT SIGTERM` kills both PIDs and the surrounding process group.

| Service     | URL                                                  |
|-------------|------------------------------------------------------|
| Backend API | `http://localhost:8000`                              |
| OpenAPI     | `http://localhost:8000/docs` (Swagger UI, autogen)   |
| Frontend    | Printed by Vite (typically `http://localhost:5173`)  |

> After cloning, you can go straight to `./start.sh`. No separate install step is required.

---

## Manual Setup (Alternative)

### Backend

```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # then fill in your API keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

---

## Docker Compose

```bash
docker-compose up --build
```

| Service  | Image source     | Port  | Notes                                              |
|----------|------------------|-------|----------------------------------------------------|
| backend  | `./Backend`      | 8000  | Hot-reload via bind mount; reads `Backend/.env`    |
| frontend | `./Frontend`     | 3000  | HMR via bind mount; depends on `backend`           |

Both services are configured with `restart: unless-stopped`. The frontend container expects port 3000 — update `playwright.config.ts` / Vite host config if you change it.

---

## Environment Variables

Copy `Backend/.env.example` → `Backend/.env` and fill in:

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `FINNHUB_API_KEY`      | yes      | Real-time quotes, company profiles, news, financials, search ([finnhub.io](https://finnhub.io)) |
| `TWELVE_DATA_API_KEY`  | yes      | Historical OHLCV ([twelvedata.com](https://twelvedata.com)) |
| `AI100_API_KEY`        | yes      | Qualcomm AI100 via Cirrascale AI Suite |
| `AI100_BASE_URL`       | no       | Defaults to `https://aisuite.cirrascale.com/apis/v2` |
| `AI100_MODEL`          | no       | e.g. `Llama-3.1-8B` or `DeepSeek-R1-Distill-Llama-70B` |
| `SUPABASE_URL`         | yes      | Supabase project URL |
| `SUPABASE_KEY`         | yes      | Supabase service role key (server-side only) |
| `RESEND_API_KEY`       | optional | Required only if email notifications are enabled |

> Run `Backend/supabase_schema.sql`, `supabase_migration*.sql`, and `vector_setup.sql` in your Supabase SQL editor before first run.

---

## Features

### Stock Dashboard (`/`)
- Live quotes (price, change %, volume) via Finnhub.
- Multi-period interactive charts: **1D / 5D / 1M / 3M / 1Y / 5Y** with event annotations.
- Company statistics panel: market cap, P/E, dividend yield, 52-week range.
- Company profile: CEO, employees, HQ, founded year, industry.
- Watchlist with sparkline trend, color-coded P&L, and per-row news-briefing toggle.

### AI-Powered News (`/news`, `/news/:ticker`)
- Per-ticker and market-wide news scraped via newspaper3k.
- AI100 LLM summarization, sentiment, and keyword extraction per article.
- Vector embeddings (sentence-transformers + pgvector) for related-article discovery.
- Aggregated multi-article summaries on demand.

### Sentiment Engine (`/sentiment-reports`)
- One-click ingestion of last *N* quarterly or annual periods from Finnhub financials.
- Normalizes raw filings into structured rows in Supabase.
- Generates a horizon-aware report (1D / 1W / 1M / 3M / 6M) blending:
  - Quantitative scores from ingested financials,
  - News-sentiment aggregation,
  - LLM qualitative analysis pass.
- Reports cached in Supabase for 24h; `force_refresh=true` to bypass.

### Natural-Language Reminders (`/reminders`)
- Plain-English authoring: *"Alert me when AAPL drops below $170"*, *"Remind me to sell NVDA if it's up 5%"*.
- LLM extracts ticker, action, condition type, target price, percent change, trigger time.
- Regex fast-path + regex fallback when the LLM is unavailable.
- Condition types: `price_above`, `price_below`, `percent_change`, `time_based`, `custom`.
- Active alerts panel shows triggered reminders with current prices.
- Background price monitor evaluates conditions and writes alerts asynchronously.

### Unified Notifications (Header bell)
- One feed combining:
  - Market-move pings,
  - Daily 10 AM ET morning **news briefings** per watchlist symbol,
  - Triggered reminder alerts.
- Dismiss-per-item and clear-all; dismissed IDs persisted in Supabase.
- Optional email delivery via Resend after email confirmation.

### AI Chatbot (`/chatbot`)
- Multi-turn chat with persistent history sidebar.
- ELI5 mode and optional news grounding (`include_news`, `improve_summary`).
- Auto-detects tickers (regex + Finnhub Search API + AI fallback) and stitches in live quotes / scraped news.
- Voice input via the Web Speech API.

### Account Settings
- Set + verify email via 6-digit confirmation code (Resend).
- Toggle email notifications per-user.

---

## Technology Stack

### Backend

| Layer                  | Technology |
|------------------------|------------|
| Web framework          | FastAPI + Uvicorn |
| Validation             | Pydantic |
| Real-time market data  | Finnhub API (quotes, profile, search, news, financials) |
| Historical data        | TwelveData API |
| LLM                    | Qualcomm AI100 via Cirrascale AI Suite |
| News scraping          | newspaper3k + lxml + lxml-html-clean |
| Vector search          | sentence-transformers + scikit-learn + Supabase pgvector |
| Database               | Supabase (Postgres) + local SQLite cache (`stock_data.db`) |
| Email delivery         | Resend |
| Data manipulation      | pandas, numpy, pytz |
| Tests                  | pytest + pytest-asyncio |

### Frontend

| Layer            | Technology |
|------------------|------------|
| UI framework     | React 18 + TypeScript |
| Build tool       | Vite 5 |
| Styling          | Tailwind CSS + `@tailwindcss/typography` + `tailwind-merge` + `clsx` |
| Charting         | Recharts + Plotly.js (`react-plotly.js`) |
| Routing          | React Router v6 |
| Icons            | Lucide React |
| Markdown         | `react-markdown` + `remark-gfm` |
| Mobile           | Capacitor (iOS + Android) |
| Unit tests       | Vitest + Testing Library + jsdom + MSW |
| E2E tests        | Playwright (Chromium) |

---

## API Reference

All endpoints are mounted under `/api/v1` unless noted otherwise. Visit `http://localhost:8000/docs` for live OpenAPI / Swagger.

### Stock Data
| Method | Path                                        | Description |
|--------|---------------------------------------------|-------------|
| `GET`  | `/api/v1/quote`                             | Real-time quote + key statistics |
| `GET`  | `/api/v1/search`                            | Symbol search (Finnhub) |
| `GET`  | `/api/v1/history/{symbol}?timeframe=1D`     | OHLCV history (`1D`, `5D`, `1M`, `3M`, `1Y`, `5Y`) + chart events |
| `GET`  | `/api/v1/companies`                         | Static SEC company / ticker list |
| `GET`  | `/api/v1/stocks/{ticker}/event-news?dates=` | Per-date news annotations for chart events |

### News
| Method | Path                                 | Description |
|--------|--------------------------------------|-------------|
| `GET`  | `/api/v1/news/{ticker}`              | AI-summarized company news (default last 7 days; `from_date`, `to_date`, `force_refresh`) |
| `GET`  | `/api/v1/news`                       | Aggregated market news |
| `GET`  | `/api/v1/news/similar/{url_hash}`    | Vector-similar articles |

### Reminders & Alerts
| Method   | Path                                       | Description |
|----------|--------------------------------------------|-------------|
| `POST`   | `/api/v1/reminders/parse`                  | Parse natural-language reminder text |
| `POST`   | `/api/v1/reminders`                        | Persist a reminder + immediate condition check |
| `GET`    | `/api/v1/reminders`                        | List all reminders |
| `GET`    | `/api/v1/reminders/{id}`                   | Fetch reminder by ID |
| `PATCH`  | `/api/v1/reminders/{id}/status`            | Update status (`active` / `triggered` / `expired` / `cancelled`) |
| `DELETE` | `/api/v1/reminders/{id}`                   | Hard-delete reminder |
| `GET`    | `/api/v1/alerts`                           | List triggered alerts |
| `PATCH`  | `/api/v1/alerts/{id}/read`                 | Mark alert as read |
| `DELETE` | `/api/v1/alerts/{id}`                      | Dismiss alert |

### Watchlist
| Method   | Path                              | Description |
|----------|-----------------------------------|-------------|
| `GET`    | `/api/v1/watchlist`               | Watchlist enriched with live price + change |
| `POST`   | `/api/v1/watchlist`               | Add `{symbol, name}` |
| `DELETE` | `/api/v1/watchlist/{symbol}`      | Remove symbol |

### Notifications & News Briefings
| Method   | Path                                                | Description |
|----------|-----------------------------------------------------|-------------|
| `GET`    | `/api/v1/notifications`                             | Unified feed (alerts + market moves + briefings) |
| `POST`   | `/api/v1/notifications/dismiss`                     | Dismiss a notification by ID |
| `POST`   | `/api/v1/notifications/clear-all`                   | Dismiss everything |
| `POST`   | `/api/v1/news-briefing/generate`                    | Generate 10 AM ET briefings for enabled watchlist symbols |
| `POST`   | `/api/v1/news-briefing/toggle/{symbol}`             | Toggle briefings per symbol |

### Chat
| Method | Path                  | Description |
|--------|-----------------------|-------------|
| `POST` | `/api/v1/chat`        | Multi-turn chat (`message`, `eli5`, `include_news`, `ticker`, `improve_summary`, `history`) |

### Sentiment Engine
| Method | Path                                      | Description |
|--------|-------------------------------------------|-------------|
| `POST` | `/api/v1/sentiment/ingest/{ticker}`       | Ingest financials (`period_type=quarterly\|annual`, `num_periods=1..12`) |
| `GET`  | `/api/v1/sentiment/data/{ticker}`         | Stored financial rows (`period_type`, `limit`) |
| `GET`  | `/api/v1/sentiment/llm-input/{ticker}`    | Latest structured LLM input |
| `GET`  | `/api/v1/sentiment/report/{ticker}`       | Generate / fetch cached report (`horizon=1D\|1W\|1M\|3M\|6M`, `force_refresh`) |

### Account
| Method | Path                                       | Description |
|--------|--------------------------------------------|-------------|
| `GET`  | `/api/v1/account/settings`                 | Get user settings (email, confirmation status, toggles) |
| `POST` | `/api/v1/account/settings`                 | Save email + send 6-digit confirmation |
| `POST` | `/api/v1/account/confirm-email`            | Verify confirmation code |
| `PUT`  | `/api/v1/account/email-notifications`      | Toggle email notifications |

---

## Database & Schema

All persistent state lives in **Supabase (Postgres)**. The local `stock_data.db` SQLite file is used only as a hot cache for the OHLCV history loader.

Run these SQL files in the Supabase SQL editor on first setup:

1. `Backend/supabase_schema.sql` — base tables (`watchlist`, `reminders`, `alerts`, `notifications`, `dismissed_notifications`, `user_settings`, `news_articles`, `sentiment_reports`, `financial_data`, …).
2. `Backend/supabase_migration.sql` — incremental migrations.
3. `Backend/supabase_migration_stock_event_news.sql` — chart-event news cache.
4. `Backend/vector_setup.sql` — enables `pgvector` extension and indexes for embedding-based news similarity.

---

## Background Jobs

- **Price monitor** (`services/price_monitor.py`) — async loop that polls active reminders and writes alerts into Supabase. Disabled by default; flip `ENABLE_PRICE_MONITOR = True` in `Backend/main.py` to enable. Uses Finnhub API credits.
- **Daily news briefings** — fired client-side at 10 AM ET against `POST /news-briefing/generate`; the backend dedupes via `news_article_already_sent` and persists notifications + sends emails (if enabled).

---

## Testing

### Backend (pytest)

```bash
cd Backend
source venv/bin/activate
pytest
```

Test suites under `Backend/tests/`:
- `test_financial_data.py` — financial ingestion + normalization.
- `test_sentiment.py`, `test_sentiment_router.py`, `test_sentiment_integration.py` — sentiment engine + router contract.
- `test_regression_news.py` — news pipeline regressions.
- `test_regression_notifications.py` — notification dismissal + dedup.
- `test_regression_reminders.py` — NL parser + reminder lifecycle.
- `test_regression_watchlist.py` — watchlist CRUD + enrichment.

Top-level scripts (`test_chat_news.py`, `test_db_similarity.py`, `test_search.py`, `test_similarity.py`) are ad-hoc dev probes.

### Frontend — Unit (Vitest)

```bash
cd Frontend
npm test                # one-shot
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```

Vitest uses `jsdom` and MSW (handlers in `src/__tests__/mocks/`).

### Frontend — E2E (Playwright)

```bash
cd Frontend
npx playwright test
```

Specs in `e2e/`:
- `regression.spec.ts` — 15 behavioral non-regression checks across all features.
- `sentiment.spec.ts` — sentiment-engine UI flow.

Playwright reuses an existing dev server on `http://localhost:3000`, otherwise starts one.

---

## Mobile (Capacitor)

The Frontend ships as native iOS and Android apps via Capacitor — same React/TS source, separate native shells.

```bash
cd Frontend
npm run build               # produce web assets
npx cap sync                # copy assets into android/ios projects
npx cap open ios            # open in Xcode
npx cap open android        # open in Android Studio
```

Project metadata lives in `capacitor.config.ts`. Native shells are committed under `Frontend/android/` and `Frontend/ios/`.

---

## Prerequisites

- **Python 3.8+** (3.11 in Docker) with `pip` and `venv`.
- **Node.js 18+** and `npm`.
- **API keys** — Finnhub, TwelveData, Cirrascale/AI100, Supabase. Resend optional (only for email notifications).
- For mobile builds: **Xcode 15+** (iOS) and/or **Android Studio + JDK 17** (Android).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|-------------------|
| `Supabase connection check failed` on startup | `SUPABASE_URL` / `SUPABASE_KEY` missing; schema SQL not yet run. |
| `news router not loaded` warning | `sentence-transformers` and friends failed to install — re-run `pip install -r requirements.txt`. |
| Reminders never trigger | Background monitor is disabled by default. Set `ENABLE_PRICE_MONITOR = True` in `Backend/main.py`. |
| Email confirmation never arrives | `RESEND_API_KEY` not set, or sender domain not verified in Resend. |
| Port `8000` already bound | `start.sh` clears it automatically; otherwise `lsof -ti:8000 \| xargs kill -9`. |
| Playwright can't reach the app | Confirm Vite is on port 3000 (or update `playwright.config.ts`). |

---

## Contributing & License

This is a capstone project for **Qualcomm**. For questions or contributions, contact the development team.

© 2025 Qualcomm AI Financial Insights Engine — Capstone Project.
