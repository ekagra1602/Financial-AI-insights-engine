# Qualcomm AI Financial Insights Engine

A full-stack financial insights platform powered by Qualcomm AI100 (via Cirrascale). Combines real-time market data, AI-driven news analysis, natural language reminders, and interactive charting in a single dashboard.

---

## Project Structure

```
qualcomm-financial-insights-engine/
├── Backend/                    # Python FastAPI backend
│   ├── main.py                 # App entry point, CORS, router registration
│   ├── models.py               # Pydantic data models
│   ├── database.py             # Database initialization
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Environment variables (not committed)
│   ├── .env.example            # Environment variable template
│   ├── company_tickers.json    # Static company/ticker data
│   ├── stock_data.db           # SQLite cache
│   ├── routers/                # API route handlers
│   │   ├── reminders.py        # Natural language reminder parsing
│   │   ├── stock_data.py       # Historical price data
│   │   ├── news.py             # News fetching and similarity search
│   │   ├── tickers.py          # Company/ticker lookup
│   │   └── watchlist.py        # Watchlist management
│   └── services/               # Business logic
│       ├── ai100_client.py     # Qualcomm AI100 / Cirrascale LLM client
│       ├── reminder_parser.py  # NL reminder parsing (LLM + regex fallback)
│       ├── finnhub_client.py   # Real-time stock quotes and company data
│       ├── stock_manager.py    # Historical data via TwelveData API
│       ├── news_processor.py   # News scraping, AI summarization
│       ├── embeddings.py       # Vector embeddings for news similarity
│       └── supabase_client.py  # Supabase database integration
├── Frontend/                   # React + TypeScript + Vite dashboard
│   ├── src/
│   │   ├── pages/              # Top-level page components
│   │   │   ├── HomePage.tsx    # Main dashboard (watchlist + charts)
│   │   │   ├── RemindersPage.tsx # Stock alert management
│   │   │   ├── ChatbotPage.tsx # AI chat assistant
│   │   │   ├── NewsPage.tsx    # Financial news feed
│   │   │   └── SentimentPage.tsx # Market sentiment dashboard
│   │   ├── components/         # Reusable UI components
│   │   │   ├── StockChart.tsx  # Multi-period interactive chart
│   │   │   ├── CompanyStats.tsx # Key statistics panel
│   │   │   ├── reminders/      # Reminder UI sub-components
│   │   │   └── news/           # News UI sub-components
│   │   ├── services/
│   │   │   └── api.ts          # Backend API client
│   │   ├── data/               # Demo/fallback data
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   └── router.tsx          # React Router configuration
│   ├── package.json
│   └── vite.config.ts
├── start.sh                    # One-command startup script
└── README.md
```

---

## Quick Start

The easiest way to run the project is with the provided startup script:

```bash
./start.sh
```

This single command handles everything — see [How start.sh Works](#how-startsh-works) below.

---

## How start.sh Works

`start.sh` starts both the backend and frontend in a single terminal session and cleanly shuts both down on `Ctrl+C`.

**What it does, step by step:**

1. **Port cleanup** — Checks if port `8000` is already in use and kills any occupying process so the backend can always bind to it cleanly.

2. **Backend startup**
   - Changes into `Backend/`
   - Creates a Python `venv` if one doesn't exist yet
   - Activates the virtual environment
   - Runs `pip install -r requirements.txt` (idempotent — fast when already up to date)
   - Starts the FastAPI server with `uvicorn main:app --reload --port 8000` in the background
   - Returns to the repo root and waits 2 seconds for the backend to initialize

3. **Frontend startup**
   - Changes into `Frontend/`
   - Runs `npm install` (idempotent — skipped quickly when up to date)
   - Starts the Vite dev server with `npm run dev` in the background

4. **Graceful shutdown** — A `trap` on `SIGINT`/`SIGTERM` (i.e., `Ctrl+C`) kills both background processes and their process group cleanly.

**URLs after startup:**
| Service  | URL |
|----------|-----|
| Backend API | `http://localhost:8000` |
| Frontend | Printed by Vite (typically `http://localhost:5173`) |

> **Note:** The script auto-installs all dependencies on every run, so after cloning you can go straight to `./start.sh` without separate install steps.

---

## Manual Setup (Alternative)

### Backend

```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in your API keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `Backend/.env.example` to `Backend/.env` and fill in the values:

| Variable | Description |
|----------|-------------|
| `FINNHUB_API_KEY` | Real-time stock quotes and company profiles ([finnhub.io](https://finnhub.io)) |
| `TWELVE_DATA_API_KEY` | Historical OHLCV price data ([twelvedata.com](https://twelvedata.com)) |
| `AI100_API_KEY` | Qualcomm AI100 via Cirrascale AI Suite |
| `AI100_BASE_URL` | Cirrascale endpoint (e.g. `https://aisuite.cirrascale.com/apis/v2`) |
| `AI100_MODEL` | Model name (e.g. `DeepSeek-R1-Distill-Llama-70B`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |

---

## Features

### Stock Dashboard
- Live stock quotes (price, change, volume) via Finnhub
- Multi-period interactive charts: **1D / 1W / 1M / 3M / YTD / 1Y / 5Y / MAX**
- Company statistics panel: market cap, P/E ratio, dividend yield, 52-week range
- Company profile: CEO, employees, headquarters, founded date
- Watchlist with sparkline trend charts and color-coded P&L

### AI-Powered News
- Company-specific and market-wide news via web scraping
- AI100 LLM summarization, sentiment analysis, and keyword extraction per article
- Vector embeddings (sentence-transformers) for related article discovery

### Natural Language Reminders
- Type reminders in plain English: *"Alert me when AAPL drops below $170"* or *"Remind me to sell NVDA if it's up 5%"*
- AI100 LLM extracts structured data: ticker, action, condition type, target price, percent change
- Regex-based fallback if the backend is unavailable
- Active alerts panel shows triggered reminders with current prices
- Supports condition types: `price_above`, `price_below`, `percent_change`, `time_based`

### AI Chatbot
- Multi-turn chat interface with conversation history
- Voice input via Web Speech API
- Intended for natural language queries about stocks and markets

### Market Sentiment
- Sentiment dashboard with visualizations of market mood
- Powered by AI-analyzed news across tracked tickers

---

## Technology Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Web framework | FastAPI + Uvicorn |
| Data validation | Pydantic |
| Stock data (real-time) | Finnhub API |
| Stock data (historical) | TwelveData API |
| AI / LLM | Qualcomm AI100 via Cirrascale |
| News scraping | newspaper3k + lxml |
| Vector search | sentence-transformers + scikit-learn |
| Database | Supabase (Postgres) + SQLite (local cache) |
| Data manipulation | pandas, numpy |

### Frontend
| Layer | Technology |
|-------|-----------|
| UI framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Charting | Recharts + Plotly.js |
| Routing | React Router v6 |
| Icons | Lucide React |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/quote` | Real-time stock quote + key statistics |
| `GET` | `/api/v1/search` | Stock symbol search |
| `GET` | `/api/v1/history/{symbol}` | Historical OHLCV data (timeframe param) |
| `GET` | `/api/v1/companies` | Full company/ticker list |
| `GET` | `/api/v1/news/{ticker}` | AI-summarized company news |
| `GET` | `/api/v1/news` | General market news |
| `GET` | `/api/v1/news/similar/{url_hash}` | Semantically similar articles |
| `POST` | `/api/v1/reminders/parse` | Parse natural language reminder text |

---

## Prerequisites

- **Python 3.8+** with `pip` and `venv`
- **Node.js 16+** and `npm`
- API keys for Finnhub, TwelveData, Cirrascale/AI100, and Supabase

---

## Contributing

This is a capstone project for Qualcomm. For questions or contributions, contact the development team.

## License

© 2025 Qualcomm AI Financial Insights Engine — Capstone Project
