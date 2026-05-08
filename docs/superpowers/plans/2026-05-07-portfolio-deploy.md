# Portfolio Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Financial AI Insights Engine to public URLs as a polished portfolio piece (Frontend on Vercel, Backend on Render free tier), fixing all in-scope audit findings along the way.

**Architecture:** Static SPA frontend on Vercel + Docker container backend on Render. Connected by `VITE_API_BASE_URL` (Vercel env) pointing at `https://<service>.onrender.com/api/v1`. CORS locked down via `FRONTEND_URL` (Render env). External services (Supabase, Finnhub, TwelveData, AI100, Resend) stay on existing accounts.

**Tech Stack:** React 18 + Vite 5 + TypeScript + Tailwind (frontend), FastAPI + Python 3.11 + Uvicorn + Supabase (backend), Vercel + Render (hosting).

**Spec:** `docs/superpowers/specs/2026-05-07-portfolio-deploy-design.md`

---

## File Map

### Files modified
- `Frontend/src/services/api.ts` — env-driven base URL
- `Frontend/src/components/Chatbot.tsx` — drop relative URL fallback, generic error message
- `Frontend/src/components/Header.tsx` — remove WebSearch nav entry
- `Frontend/src/router.tsx` — remove `/web-search` route
- `Frontend/src/pages/HomePage.tsx` — lazy-load StockChart
- `Frontend/vite.config.ts` — manualChunks for plotly, drop console.log in prod
- `Backend/main.py` — CORS env var
- `Backend/Dockerfile` — production CMD with `$PORT`, copy source
- `Backend/services/financial_data_service.py` — fix deprecated `utcnow()`
- `Backend/services/finnhub_client.py` — add timeouts to all `requests.get`
- `Backend/services/ai100_client.py` — `tool_choice: "none"` + scrub log lines
- `Backend/services/price_monitor.py` — timezone-aware datetime comparison
- `Backend/services/news_processor.py` — lazy NLTK download
- `Backend/routers/news_briefing.py` — drop `_10AM` from dedup ID
- `Backend/requirements.txt` — pinned versions from `pip freeze`
- `Backend/.env.example` — fix `AI100_MODEL` default
- `CLAUDE.md` — rewrite database section, update Chatbot section

### Files created
- `Frontend/.env.example`
- `vercel.json`
- `DEPLOY.md`

### Files deleted
- `Frontend/src/components/WebSearch.tsx`
- `Frontend/src/components/SentimentHome.tsx`
- `Frontend/src/components/NewsFeed.tsx`
- `Frontend/src/data/demoData.ts`
- `Backend/app/` (entire directory: `api/`, `core/`, `models/`, `services/` subdirs all containing only `__pycache__`)
- `Backend/temp_ai100_main.py`
- `Backend/test_chat_news.py`
- `Backend/test_search.py`
- `Backend/test_db_similarity.py`
- `Backend/test_similarity.py`
- `.github/java-upgrade/`
- `package-lock.json` (root, 113 bytes empty)

### Local-only files removed (not tracked, just clean up)
- `Backend/stock_data.db`

---

## Task 1: Create deploy/portfolio branch

**Files:** None modified — branch creation only

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

If not clean, stash or commit existing changes first.

- [ ] **Step 2: Verify on main and up-to-date**

Run: `git checkout main && git pull origin main`
Expected: `Already up to date.` or successful pull

- [ ] **Step 3: Create and switch to branch**

Run: `git checkout -b deploy/portfolio`
Expected: `Switched to a new branch 'deploy/portfolio'`

---

## Task 2: Frontend env-driven API base URL

**Files:**
- Modify: `Frontend/src/services/api.ts:3,471`
- Modify: `Frontend/src/components/Chatbot.tsx:43-51,305`
- Create: `Frontend/.env.example`

- [ ] **Step 1: Replace `API_BASE_URL` constant**

Edit `Frontend/src/services/api.ts`. Replace line 3:

```typescript
const API_BASE_URL = "http://localhost:8000/api/v1";
```

with:

```typescript
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");
```

- [ ] **Step 2: Replace `ACCOUNT_BASE` constant**

In the same file, replace line 471:

```typescript
const ACCOUNT_BASE = "http://localhost:8000/api/v1/account";
```

with:

```typescript
const ACCOUNT_BASE = `${API_BASE_URL}/account`;
```

- [ ] **Step 3: Simplify Chatbot endpoint resolution**

Edit `Frontend/src/components/Chatbot.tsx`. Replace lines 43–51:

```typescript
const buildChatEndpoints = (): string[] => {
  const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  return Array.from(new Set([
    '/api/v1/chat',
    `${normalizedBaseUrl}/api/v1/chat`,
  ]));
};
```

with:

```typescript
const buildChatEndpoints = (): string[] => {
  const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  return [`${normalizedBaseUrl}/chat`];
};
```

- [ ] **Step 4: Fix user-visible error message**

In the same file, replace line 305:

```typescript
        friendlyMessage = 'I couldn\'t reach the backend chat service. Make sure backend is running at http://127.0.0.1:8000, then try again.';
```

with:

```typescript
        friendlyMessage = "I couldn't reach the chat service. Please try again in a moment.";
```

- [ ] **Step 5: Create `Frontend/.env.example`**

Create new file `Frontend/.env.example` with contents:

```
# Frontend environment variables
# VITE_API_BASE_URL must include the /api/v1 path suffix.
# Local dev: leave unset; api.ts falls back to http://127.0.0.1:8000/api/v1
# Production (Vercel): set this to your Render backend URL + /api/v1
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

- [ ] **Step 6: Verify build still succeeds**

Run: `cd Frontend && npm run build`
Expected: build completes without TypeScript errors. Output ends with `✓ built in Xs`.

- [ ] **Step 7: Verify dev mode still works against localhost**

Run: `cd Frontend && npm run dev`
Expected: Vite starts on port 3000. Open http://localhost:3000 in a browser; the home page loads (assuming backend running on 8000).

Stop the dev server with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/services/api.ts Frontend/src/components/Chatbot.tsx Frontend/.env.example
git commit -m "feat(frontend): make API base URL env-driven

Replaces hardcoded localhost:8000 URLs in api.ts and Chatbot.tsx with
import.meta.env.VITE_API_BASE_URL (with localhost fallback for local
dev). Drops the relative /api/v1/chat candidate from the Chatbot
endpoint list. Replaces user-visible localhost:8000 error message with
a generic message. Adds Frontend/.env.example documenting the variable."
```

---

## Task 3: Hide WebSearch + delete dead frontend components

**Files:**
- Modify: `Frontend/src/router.tsx`
- Modify: `Frontend/src/components/Header.tsx`
- Delete: `Frontend/src/components/WebSearch.tsx`
- Delete: `Frontend/src/components/SentimentHome.tsx`
- Delete: `Frontend/src/components/NewsFeed.tsx`
- Delete: `Frontend/src/data/demoData.ts`

- [ ] **Step 1: Remove WebSearch route from router**

Edit `Frontend/src/router.tsx`. Delete the import line:

```typescript
import WebSearch from './components/WebSearch';
```

And delete the route block:

```typescript
      {
        path: '/web-search',
        element: <WebSearch />
      },
```

- [ ] **Step 2: Remove WebSearch nav entry from Header**

Edit `Frontend/src/components/Header.tsx`. In the `navItems` array (around line 46), delete this entry:

```typescript
    { to: '/web-search', label: 'Search', icon: Search, match: (p: string) => p === '/web-search' },
```

The `Search` import from `lucide-react` may now be unused. Check the imports; if `Search` is no longer used elsewhere in Header.tsx, remove it from the import statement at the top.

- [ ] **Step 3: Delete the four dead component/data files**

Run:

```bash
rm Frontend/src/components/WebSearch.tsx
rm Frontend/src/components/SentimentHome.tsx
rm Frontend/src/components/NewsFeed.tsx
rm Frontend/src/data/demoData.ts
```

- [ ] **Step 4: Verify build still succeeds**

Run: `cd Frontend && npm run build`
Expected: build completes without TypeScript errors. If TypeScript reports unused imports or a missing module, find and fix the offending import line.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/router.tsx Frontend/src/components/Header.tsx
git rm Frontend/src/components/WebSearch.tsx Frontend/src/components/SentimentHome.tsx Frontend/src/components/NewsFeed.tsx Frontend/src/data/demoData.ts
git commit -m "chore(frontend): remove WebSearch route and dead components

WebSearch was static demo data with no real backend integration.
SentimentHome and NewsFeed are unused per CLAUDE.md (verified by
grep). demoData.ts was only referenced by these now-deleted files."
```

---

## Task 4: Vite production optimizations + vercel.json

**Files:**
- Modify: `Frontend/vite.config.ts`
- Modify: `Frontend/src/pages/HomePage.tsx`
- Create: `vercel.json`

- [ ] **Step 1: Add build config + console-stripping to Vite**

Edit `Frontend/vite.config.ts`. Replace the entire file with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['react-plotly.js', 'plotly.js'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  resolve: {
    alias: {
      'buffer/': 'buffer',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js', 'react-plotly.js'],
        },
      },
    },
  },
  esbuild: {
    pure: ['console.log'],
  },
})
```

- [ ] **Step 2: Lazy-load StockChart in HomePage**

Edit `Frontend/src/pages/HomePage.tsx`. Replace line 1–2:

```typescript
import React, { useState, useEffect } from 'react';
import { StockChart } from '../components/StockChart';
```

with:

```typescript
import React, { useState, useEffect, Suspense, lazy } from 'react';
const StockChart = lazy(() =>
  import('../components/StockChart').then(m => ({ default: m.StockChart }))
);
```

Then find the `<StockChart` usage (around line 147) and wrap it in `<Suspense>`. Find:

```typescript
                    <StockChart
```

The `<StockChart ... />` element will span multiple lines. Wrap the entire element in a `<Suspense fallback={...}>...</Suspense>`. Example pattern (the exact attributes will match the existing StockChart usage):

```typescript
                    <Suspense fallback={<div className="w-full h-96 flex items-center justify-center text-text-secondary">Loading chart...</div>}>
                      <StockChart
                        ... existing props ...
                      />
                    </Suspense>
```

- [ ] **Step 3: Create `vercel.json`**

Create new file `vercel.json` at the repo root with contents:

```json
{
  "buildCommand": "cd Frontend && npm install && npm run build",
  "outputDirectory": "Frontend/dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Verify production build produces a separate plotly chunk**

Run: `cd Frontend && npm run build`
Expected: build succeeds. The output table now shows two separate chunks like:

```
dist/assets/plotly-XXXXX.js     ~5,000 kB
dist/assets/index-YYYYY.js        ~400 kB
```

(numbers approximate; the key thing is that plotly is its own chunk, not bundled with index).

- [ ] **Step 5: Commit**

```bash
git add Frontend/vite.config.ts Frontend/src/pages/HomePage.tsx vercel.json
git commit -m "feat(frontend): code-split plotly + add vercel.json + drop console.log in prod

Splits plotly.js / react-plotly.js into a separate Rollup chunk so the
~5MB charting library is loaded only when the home page renders the
chart. Wraps StockChart in React.lazy()+Suspense for deferred load.
Adds vercel.json with build command, output dir, and SPA rewrite.
Configures esbuild to strip console.log calls in production builds
(console.error/warn are preserved)."
```

---

## Task 5: Backend security and correctness

**Files:**
- Modify: `Backend/main.py`
- Modify: `Backend/services/financial_data_service.py`
- Modify: `Backend/services/finnhub_client.py`
- Modify: `Backend/services/ai100_client.py`
- Modify: `Backend/services/price_monitor.py`

- [ ] **Step 1: Tighten CORS in `main.py`**

Edit `Backend/main.py`. At the top of the file, after the existing imports, add:

```python
import os
```

Find the existing CORS middleware block (around line 28–35):

```python
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all. In prod, restrict to frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Replace it with:

```python
# Configure CORS — locked down to the frontend URL set via env var
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 2: Fix deprecated `utcnow()` in financial_data_service**

Edit `Backend/services/financial_data_service.py:163`. Find:

```python
                "updated_at": datetime.datetime.utcnow().isoformat(),
```

Replace with:

```python
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
```

- [ ] **Step 3: Add timeouts to all Finnhub HTTP calls**

Edit `Backend/services/finnhub_client.py`. There are 8 `requests.get(url, params=params)` calls without timeouts. Add `timeout=20` to each. Specifically, find each line matching:

```python
    response = requests.get(url, params=params)
```

and replace with:

```python
    response = requests.get(url, params=params, timeout=20)
```

The lines are inside these functions: `get_finnhub_quote`, `get_finnhub_metric`, `get_finnhub_profile`, `get_finnhub_search`, `get_company_news`, `get_financials_reported`, `get_stock_earnings`, `get_market_news`. The existing `get_company_news_safe` already uses `timeout=20`; leave it alone.

You can do this efficiently with a sed command. From the repo root:

```bash
sed -i.bak 's/requests\.get(url, params=params)$/requests.get(url, params=params, timeout=20)/g' Backend/services/finnhub_client.py
rm Backend/services/finnhub_client.py.bak
```

Verify no lines were missed:

```bash
grep -n "requests.get(url, params=params)$" Backend/services/finnhub_client.py
```

Expected: no output (all calls now include `timeout`).

- [ ] **Step 4: Add `tool_choice: "none"` to `analyze_text` payload**

Edit `Backend/services/ai100_client.py`. Find the payload block in `analyze_text` (around line 276–284):

```python
    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,  # Lower temperature for more deterministic output
        "max_tokens": 600,
    }
```

Add `"tool_choice": "none",` to the dict:

```python
    payload = {
        "model": AI100_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,  # Lower temperature for more deterministic output
        "max_tokens": 600,
        "tool_choice": "none",
    }
```

- [ ] **Step 5: Add `tool_choice: "none"` to `_call_chat_completion` payload**

In the same file, find the payload in `_call_chat_completion` (around line 482–487):

```python
    payload = {
        "model": AI100_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
```

Add `"tool_choice": "none",`:

```python
    payload = {
        "model": AI100_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "tool_choice": "none",
    }
```

- [ ] **Step 6: Strip `response.text` from log lines in ai100_client**

In the same file, three log lines leak response bodies. Replace each.

Find (around line 72):

```python
            print(f"[AI100] Error {response.status_code}: {response.text[:500]}")
```

Replace with:

```python
            print(f"[AI100] Error: HTTP {response.status_code}")
```

Find (around line 134):

```python
            print(f"[AI100] Error {response.status_code}: {response.text[:500]}")
```

Replace with:

```python
            print(f"[AI100] Error: HTTP {response.status_code}")
```

Find (around line 302):

```python
                print(f"   ❌ API Error: {response.status_code} — {response.text[:300]}")
```

Replace with:

```python
                print(f"   ❌ API Error: HTTP {response.status_code}")
```

- [ ] **Step 7: Fix timezone-aware datetime comparison in price_monitor**

Edit `Backend/services/price_monitor.py`. At the top of the file, change the import:

```python
from datetime import datetime
```

to:

```python
from datetime import datetime, timezone
```

Then find the `_check_condition` function's time-based branch (around line 36–40):

```python
    if ct == "time_based" and trig_t:
        try:
            return datetime.now() >= datetime.fromisoformat(trig_t)
        except ValueError:
            return False
```

Replace with:

```python
    if ct == "time_based" and trig_t:
        try:
            target_dt = datetime.fromisoformat(trig_t)
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
            return datetime.now(timezone.utc) >= target_dt
        except (ValueError, TypeError):
            return False
```

- [ ] **Step 8: Verify all modified Python files compile**

Run from repo root:

```bash
cd Backend && source venv/bin/activate && python -m py_compile main.py services/financial_data_service.py services/finnhub_client.py services/ai100_client.py services/price_monitor.py
```

Expected: no output (silent success). Any syntax error will print here.

- [ ] **Step 9: Verify backend still starts locally**

Set `FRONTEND_URL=http://localhost:3000` in `Backend/.env` if not already there:

```bash
echo "FRONTEND_URL=http://localhost:3000" >> Backend/.env
```

(If the line already exists, don't duplicate it. Check first with `grep FRONTEND_URL Backend/.env`.)

Run: `cd Backend && source venv/bin/activate && uvicorn main:app --reload`

Expected: server starts on port 8000. Open http://localhost:8000/docs in a browser — the FastAPI Swagger UI loads.

Stop the server with Ctrl-C.

- [ ] **Step 10: Commit**

```bash
git add Backend/main.py Backend/services/financial_data_service.py Backend/services/finnhub_client.py Backend/services/ai100_client.py Backend/services/price_monitor.py Backend/.env
git commit -m "fix(backend): security + correctness sweep

- main.py: lock CORS down to FRONTEND_URL env var (default localhost:3000)
- financial_data_service.py: replace deprecated datetime.utcnow()
- finnhub_client.py: add 20s timeout to all 8 requests.get calls
- ai100_client.py: add tool_choice:none to two missing payloads, scrub
  response.text from three error log lines
- price_monitor.py: fix naive vs timezone-aware datetime comparison in
  time_based reminder check"
```

(Note: this commit picks up `Backend/.env` only if you newly added the FRONTEND_URL line and `Backend/.env` is not gitignored. Verify first with `git status Backend/.env`. The repo's `.gitignore` should ignore `Backend/.env`, in which case the file won't be staged. That's fine — `.env` isn't supposed to be committed.)

---

## Task 6: Backend production-ready Dockerfile

**Files:**
- Modify: `Backend/Dockerfile`

- [ ] **Step 1: Replace Dockerfile contents**

Replace the entire contents of `Backend/Dockerfile` with:

```dockerfile
FROM python:3.11-slim

# System deps for newspaper3k / lxml C extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libxml2-dev libxslt1-dev gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (layer cache — only re-runs when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code into the image (was bind-mounted in dev via docker-compose)
COPY . .

# Render sets $PORT at runtime; default to 8000 for local docker run
EXPOSE 8000

# Shell-form CMD so ${PORT} env var resolves at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 2: Verify the Dockerfile builds**

Run from repo root:

```bash
docker build -t finance-backend ./Backend
```

Expected: build succeeds, ending with `Successfully tagged finance-backend:latest`. First build takes 2–4 minutes.

- [ ] **Step 3: Verify the container starts and responds**

Run:

```bash
docker run --rm -p 8000:8000 --env-file Backend/.env finance-backend
```

Expected: uvicorn logs `Application startup complete.` and listens on `:8000`.

In a second terminal, verify:

```bash
curl http://localhost:8000/
```

Expected response:

```json
{"message":"Financial Insights Engine API is running"}
```

Stop the container with Ctrl-C in the first terminal.

- [ ] **Step 4: Commit**

```bash
git add Backend/Dockerfile
git commit -m "build(backend): production-ready Dockerfile

- Drop --reload flag (dev-only)
- Copy source code into image (no longer relies on bind mount)
- Use shell-form CMD so Render's \$PORT env var expands at runtime
- Default to port 8000 if \$PORT is not set (local docker run)

docker-compose.yml continues to work because its bind mount overrides
the COPY'd source."
```

---

## Task 7: Lazy NLTK download

**Files:**
- Modify: `Backend/services/news_processor.py`

- [ ] **Step 1: Move NLTK download out of module top-level**

Edit `Backend/services/news_processor.py`. Find the top of the file (lines 1–18):

```python
import hashlib
import datetime
import json
import os
import re
from newspaper import Article
import nltk

# Download necessary NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

from services.ai100_client import analyze_text
from services.embeddings import get_embedding
from services.finnhub_client import get_company_news, get_market_news, get_finnhub_profile
from services.supabase_client import SupabaseClient
```

Replace with:

```python
import hashlib
import datetime
import json
import os
import re
from newspaper import Article
import nltk

_nltk_ready = False

def _ensure_nltk():
    """Lazily download NLTK 'punkt' tokenizer data on first use.

    Avoids the import-time network call which would hang or fail in
    serverless / read-only filesystem environments.
    """
    global _nltk_ready
    if _nltk_ready:
        return
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')
    _nltk_ready = True

from services.ai100_client import analyze_text
from services.embeddings import get_embedding
from services.finnhub_client import get_company_news, get_market_news, get_finnhub_profile
from services.supabase_client import SupabaseClient
```

- [ ] **Step 2: Call `_ensure_nltk()` from `_scrape_content`**

In the same file, find the `_scrape_content` method (around line 231–248):

```python
    def _scrape_content(self, url: str) -> str:
        """
        Uses newspaper3k to scrape article text.
        """
        try:
            # Set a timeout for download
            from newspaper import Config
```

Add a call to `_ensure_nltk()` at the very start of the method body:

```python
    def _scrape_content(self, url: str) -> str:
        """
        Uses newspaper3k to scrape article text.
        """
        _ensure_nltk()
        try:
            # Set a timeout for download
            from newspaper import Config
```

- [ ] **Step 3: Verify the file compiles**

Run from repo root:

```bash
cd Backend && source venv/bin/activate && python -m py_compile services/news_processor.py
```

Expected: no output.

- [ ] **Step 4: Verify import is now side-effect free**

Run:

```bash
cd Backend && source venv/bin/activate && python -c "from services import news_processor; print('OK')"
```

Expected: prints `OK` immediately. Should NOT print any "Downloading punkt..." messages (those should now happen only when `_scrape_content` is called).

- [ ] **Step 5: Commit**

```bash
git add Backend/services/news_processor.py
git commit -m "refactor(backend): lazy NLTK download

Moves nltk.download('punkt') out of module top-level into a
_ensure_nltk() helper called from _scrape_content() on first use.
Eliminates the import-time network call so the module can be safely
imported in environments with read-only filesystems or constrained
cold-start budgets."
```

---

## Task 8: News briefing dedup ID rename

**Files:**
- Modify: `Backend/routers/news_briefing.py`

- [ ] **Step 1: Drop `_10AM` suffix from dedup ID**

Edit `Backend/routers/news_briefing.py:54`. Find:

```python
    notif_id = f"{symbol}_NEWS_{today_str}_10AM"
```

Replace with:

```python
    notif_id = f"{symbol}_NEWS_{today_str}"
```

- [ ] **Step 2: Verify the file compiles**

Run from repo root:

```bash
cd Backend && source venv/bin/activate && python -m py_compile routers/news_briefing.py
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add Backend/routers/news_briefing.py
git commit -m "fix(backend): drop hardcoded _10AM from news briefing dedup ID

The dedup ID was \`{symbol}_NEWS_{date}_10AM\` regardless of when the
briefing actually fired (10am cron OR app-startup trigger). Now it's
\`{symbol}_NEWS_{date}\`: one briefing per symbol per day, regardless
of trigger time.

Existing rows in the news_briefing_articles table use the old ID
format and won't collide with new IDs, so this is non-breaking. After
deploy, old rows can be optionally cleaned up but it's not required."
```

---

## Task 9: Pin requirements

**Files:**
- Modify: `Backend/requirements.txt`

- [ ] **Step 1: Generate pinned requirements from current venv**

Run:

```bash
cd Backend && source venv/bin/activate && pip freeze > requirements.txt
```

This overwrites the unpinned list with a fully-pinned one (every direct + transitive dep with exact versions).

- [ ] **Step 2: Sanity check the output**

Run: `head -20 Backend/requirements.txt`

Expected: lines with the format `package==X.Y.Z`. The exact list will vary based on your venv, but should include at minimum: `fastapi`, `uvicorn`, `requests`, `python-dotenv`, `pydantic`, `newspaper3k`, `lxml`, `supabase`, `twelvedata`, `pandas`, `pytz`, `resend`, `numpy`, `pytest-asyncio`, plus their transitive deps.

- [ ] **Step 3: Verify a fresh install works**

Optional but recommended sanity check. Create a throwaway venv:

```bash
cd /tmp
python3 -m venv test-venv
source test-venv/bin/activate
pip install -r /Users/anujprabhu/Financial-AI-insights-engine/Backend/requirements.txt
deactivate
rm -rf test-venv
cd /Users/anujprabhu/Financial-AI-insights-engine
```

Expected: pip install succeeds. If a pinned version is unavailable for your platform, the fix is to remove the platform-specific package and re-pin. (Should not happen in practice for these deps.)

- [ ] **Step 4: Commit**

```bash
git add Backend/requirements.txt
git commit -m "build(backend): pin requirements.txt to exact versions

Replaces the unpinned dependency list with the output of
\`pip freeze\`. Production builds are now deterministic: same versions
will be installed regardless of when the build runs."
```

---

## Task 10: Delete dead backend code

**Files:**
- Delete: `Backend/app/` (entire directory)
- Delete: `Backend/temp_ai100_main.py`
- Delete: `Backend/test_chat_news.py`
- Delete: `Backend/test_search.py`
- Delete: `Backend/test_db_similarity.py`
- Delete: `Backend/test_similarity.py`
- Delete: `.github/java-upgrade/`
- Delete: `package-lock.json` (root, 113-byte empty file)
- Delete locally only (not tracked): `Backend/stock_data.db`

- [ ] **Step 1: Verify nothing in Backend/app/ is tracked**

Run: `git ls-files Backend/app/`
Expected: no output (the directory exists locally but contains only `__pycache__`).

- [ ] **Step 2: Delete dead code**

Run from repo root:

```bash
rm -rf Backend/app/
rm Backend/temp_ai100_main.py
rm Backend/test_chat_news.py
rm Backend/test_search.py
rm Backend/test_db_similarity.py
rm Backend/test_similarity.py
rm -rf .github/java-upgrade/
rm package-lock.json
rm -f Backend/stock_data.db
```

- [ ] **Step 3: Verify backend still starts**

Run: `cd Backend && source venv/bin/activate && uvicorn main:app --reload`
Expected: server starts cleanly on port 8000. No import errors related to deleted files.

Stop with Ctrl-C.

- [ ] **Step 4: Verify nothing imports `temp_ai100_main`**

Run: `grep -r "temp_ai100_main" /Users/anujprabhu/Financial-AI-insights-engine/Backend --include="*.py"`
Expected: no output (no remaining references).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete dead code

- Backend/app/: leftover from old project structure, only __pycache__
  remained, no source files (verified via git ls-files)
- Backend/temp_ai100_main.py: development artifact, not imported
- Backend/test_{chat_news,search,db_similarity,similarity}.py: manual
  scripts in Backend/ root that pytest auto-discovers and tries to
  run. Real tests live in Backend/tests/.
- .github/java-upgrade/: GitHub Copilot artifact, not a real CI/CD
  pipeline for this project (per CLAUDE.md)
- package-lock.json (root, 113-byte empty file): vestige

Resolves audit findings L1 and L4."
```

---

## Task 11: Update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `Backend/.env.example`
- Create: `DEPLOY.md`

- [ ] **Step 1: Fix `AI100_MODEL` default in `.env.example`**

Edit `Backend/.env.example:17`. Find:

```
AI100_MODEL=Llama-3.1-8B
```

Replace with:

```
AI100_MODEL=DeepSeek-R1-Distill-Llama-70B
```

- [ ] **Step 2: Update CLAUDE.md database section**

Edit `CLAUDE.md`. Find the section titled "## SQLite Database (stock_data.db)" (around line 88–105). Replace the entire section with:

```markdown
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
```

- [ ] **Step 3: Update CLAUDE.md Chatbot section**

Find the section about the Chatbot (typically under a "Frontend" header near "ChatbotPage / Chatbot.tsx"). Find this paragraph:

```markdown
**ChatbotPage / Chatbot.tsx**:
- **Chatbot is NOT connected to any backend.** It uses `getMockResponse()` with hardcoded string matching. The actual API call is commented out with a `TODO` comment. Conversation history is stored in `localStorage` with keys `chatbot_conversations` and `chatbot_messages_{conversationId}`.
```

Replace with:

```markdown
**ChatbotPage / Chatbot.tsx**:
- Chatbot is wired to the backend `/api/v1/chat` endpoint via `postChatMessage()`. The fetch URL is constructed from `import.meta.env.VITE_API_BASE_URL` (with a `http://127.0.0.1:8000/api/v1` fallback for local dev). Conversation history is stored in `localStorage` with keys `chatbot_conversations` and `chatbot_messages_{conversationId}`.
```

- [ ] **Step 4: Remove deleted files from CLAUDE.md "Dead Code" table**

Find the `## Dead Code / Artifacts` section in CLAUDE.md. Delete the rows for `Backend/app/`, `Backend/temp_ai100_main.py`, `Frontend/src/components/SentimentHome.tsx`, `Frontend/src/components/NewsFeed.tsx`, `Frontend/src/data/demoData.ts`, and `.github/java-upgrade/` since these no longer exist. Keep any rows for files that still exist.

- [ ] **Step 5: Add news briefing change note to CLAUDE.md**

Find the section titled "### `routers/news_briefing.py`" or similar. Update the line about the dedup ID. If it reads:

```markdown
News briefing notification ID format: `f"{symbol}_NEWS_{today_str}_10AM"` — the `_10AM` suffix is hardcoded regardless of actual trigger time.
```

Replace with:

```markdown
News briefing notification ID format: `f"{symbol}_NEWS_{today_str}"` — one briefing per symbol per day regardless of trigger time.
```

- [ ] **Step 6: Create `DEPLOY.md`**

Create new file `DEPLOY.md` at the repo root with contents:

````markdown
# Deployment Guide

This app deploys as **Frontend on Vercel** + **Backend on Render** (both free tier).

## Prerequisites

- GitHub account with this repo pushed
- Vercel account (free)
- Render account (free)
- All values from `Backend/.env` ready to paste into platform dashboards
- `SUPABASE_KEY` is the **service role key**, not the anon key (verify in Supabase dashboard → Project Settings → API)
- Resend API key with **Sending access** scope (least privilege)

## Phase 1: Deploy backend to Render

1. Render dashboard → **New → Web Service**
2. Connect GitHub, select this repo, choose deploy branch
3. Settings:
   - **Root Directory:** `Backend/`
   - **Runtime:** Docker (auto-detected from `Backend/Dockerfile`)
   - **Region:** Oregon
   - **Plan:** Free
4. Add environment variables (Settings → Environment):

   | Variable | Value |
   |---|---|
   | `FINNHUB_API_KEY` | from local `Backend/.env` |
   | `SUPABASE_URL` | from local `Backend/.env` |
   | `SUPABASE_KEY` | from local `Backend/.env` (service role key) |
   | `AI100_API_KEY` | from local `Backend/.env` |
   | `AI100_BASE_URL` | `https://aisuite.cirrascale.com/apis/v2` |
   | `AI100_MODEL` | `DeepSeek-R1-Distill-Llama-70B` |
   | `TWELVE_DATA_API_KEY` | from local `Backend/.env` |
   | `RESEND_API_KEY` | from local `Backend/.env` (Sending scope) |
   | `FRONTEND_URL` | `*` (temporary; tighten in Phase 3) |

   **Do NOT set `PORT`** — Render injects it automatically.

5. Click Deploy. First build takes ~5 minutes.
6. Once live, verify: `curl https://<your-service>.onrender.com/`. Expected: `{"message":"Financial Insights Engine API is running"}`
7. Note your Render URL.

## Phase 2: Deploy frontend to Vercel

1. Vercel dashboard → **New Project**
2. Import this repo
3. Framework: Vite (auto-detected from `vercel.json`); Root Directory: `./`
4. Environment Variables: add `VITE_API_BASE_URL=https://<your-render-url>.onrender.com/api/v1` (note the `/api/v1` suffix)
5. Deploy. Build takes ~2 minutes.
6. Note your Vercel URL.

## Phase 3: Lock down CORS

1. Render dashboard → service → Environment
2. Change `FRONTEND_URL` from `*` to your Vercel URL (no trailing slash, exact match)
3. Render auto-redeploys (~1 minute)
4. Verify CORS lockdown:

   ```bash
   curl -v -H "Origin: https://evil.example.com" https://<render-url>/api/v1/companies 2>&1 | grep -i access-control-allow-origin
   ```

   Expected: no `Access-Control-Allow-Origin: *` or `https://evil.example.com` header in response.

## Phase 4: Smoke test

Open the Vercel URL in a browser. Test the golden path:

- Home page loads, watchlist populates with default tickers
- Search a ticker (e.g., "AAPL") → CompanyStats card appears
- Navigate to **Sentiment Reports** → request a report (first call ~50s due to Render cold start; subsequent calls fast)
- **News** page loads articles
- **Chatbot** — ask "what's the latest on AAPL?" → response comes back
- **Reminders** page loads

If anything breaks, check Render logs (dashboard → service → Logs) and browser DevTools Network tab.

## Notes

- Render free tier spins down after 15 min idle. First request after sleep takes ~50s. Subsequent requests are fast.
- AI100 / Finnhub / TwelveData quotas are shared with your dev environment. Watch Render logs for 429s.
- Resend free tier: 100 emails/day.
- Auth is intentionally absent — anyone hitting the public URL can write to your watchlist, create reminders, and trigger emails. Acceptable for portfolio use.
````

- [ ] **Step 7: Verify markdown renders cleanly**

Open `DEPLOY.md` and `CLAUDE.md` in your editor's markdown preview, or just `cat` the files and skim them. No malformed tables, no orphaned headings.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md Backend/.env.example DEPLOY.md
git commit -m "docs: rewrite CLAUDE.md DB section, add DEPLOY.md, fix env example

- CLAUDE.md: replace stale SQLite section with Supabase tables list
  (the codebase migrated; the docs hadn't). Update Chatbot section to
  reflect that it IS wired to the backend (not mock as previously
  documented). Remove deleted-file entries from the Dead Code table.
  Update news_briefing dedup ID note.
- Backend/.env.example: fix AI100_MODEL default
  (was Llama-3.1-8B; actually DeepSeek-R1-Distill-Llama-70B)
- DEPLOY.md: new step-by-step guide for Render + Vercel deploy"
```

(If any of `CLAUDE.md`, `Backend/.env.example`, or `DEPLOY.md` is gitignored by the `*.md` rule, use `git add -f` for that specific file.)

---

## Task 12: Local end-to-end verification

**Files:** None modified — verification only

- [ ] **Step 1: Verify final commit history**

Run: `git log --oneline main..HEAD`
Expected: 10 commits on the branch (one per Task 2–11).

- [ ] **Step 2: Verify frontend builds in production mode**

Run: `cd Frontend && npm run build`
Expected: build completes. Output shows separate `plotly` chunk and main `index` chunk (smaller now).

- [ ] **Step 3: Verify backend starts and serves**

Run: `cd Backend && source venv/bin/activate && uvicorn main:app --reload`

In a second terminal:

```bash
curl http://localhost:8000/
curl http://localhost:8000/api/v1/companies | head -c 200
```

Expected:
- `{"message":"Financial Insights Engine API is running"}`
- A JSON array starting with company entries

Stop the server with Ctrl-C.

- [ ] **Step 4: Manual smoke test against local stack**

Start backend (`uvicorn main:app --reload` from Backend with venv active) and frontend (`npm run dev` from Frontend) simultaneously in two terminals.

Open http://localhost:3000 and verify:
- Home page loads, watchlist visible
- Search a ticker → results appear
- Navigate to **Sentiment Reports** → can request a report (may take ~30s for first call)
- **News** loads articles
- **Chatbot** → send a message → gets a response
- **Reminders** loads
- WebSearch route is gone (no nav entry, `/web-search` is a 404)

Stop both servers when verified.

- [ ] **Step 5: Push branch to origin**

Run: `git push -u origin deploy/portfolio`
Expected: `Branch 'deploy/portfolio' set up to track remote branch...`

---

## Task 13: Backend deploy to Render

**Files:** None modified — platform configuration only

- [ ] **Step 1: Sign in to Render**

Go to https://render.com and sign in. If first time, sign up with GitHub for easy repo access.

- [ ] **Step 2: Create new Web Service**

Render dashboard → click "New +" → select "Web Service" → connect GitHub if prompted → select this repo (`Financial-AI-insights-engine`).

- [ ] **Step 3: Configure service settings**

In the service creation form:

- **Name:** `financial-ai-insights-backend` (or your preference)
- **Region:** Oregon (US West)
- **Branch:** `deploy/portfolio`
- **Root Directory:** `Backend`
- **Runtime:** Docker (auto-detected)
- **Plan:** Free

Leave Build Command and Start Command empty (Docker handles them).

- [ ] **Step 4: Add environment variables**

In the Environment section of the form, add each variable. Copy values from your local `Backend/.env`:

| Key | Value |
|---|---|
| `FINNHUB_API_KEY` | (from `.env`) |
| `SUPABASE_URL` | (from `.env`) |
| `SUPABASE_KEY` | (from `.env` — service role key) |
| `AI100_API_KEY` | (from `.env`) |
| `AI100_BASE_URL` | `https://aisuite.cirrascale.com/apis/v2` |
| `AI100_MODEL` | `DeepSeek-R1-Distill-Llama-70B` |
| `TWELVE_DATA_API_KEY` | (from `.env`) |
| `RESEND_API_KEY` | (from `.env`) |
| `FRONTEND_URL` | `*` |

**Do NOT add `PORT`** — Render injects it automatically.

- [ ] **Step 5: Click "Create Web Service"**

Render will start the first build. Watch the Logs tab. First build takes 4–6 minutes (installing Python deps + lxml C extensions).

- [ ] **Step 6: Wait for service to be live**

Once Logs show `Application startup complete.` and the status badge says "Live", the service is up.

- [ ] **Step 7: Verify Render endpoint**

Run from your local machine:

```bash
curl https://<your-service-name>.onrender.com/
```

Expected: `{"message":"Financial Insights Engine API is running"}`

- [ ] **Step 8: Note the Render URL**

Save the URL (e.g., `https://financial-ai-insights-backend.onrender.com`). You'll use it in Task 14 as the `VITE_API_BASE_URL` value.

---

## Task 14: Frontend deploy to Vercel

**Files:** None modified — platform configuration only

- [ ] **Step 1: Sign in to Vercel**

Go to https://vercel.com and sign in. If first time, sign up with GitHub.

- [ ] **Step 2: Import project**

Vercel dashboard → "Add New..." → "Project" → select this repo from the GitHub list.

- [ ] **Step 3: Configure project settings**

In the import form:

- **Framework Preset:** Vite (should auto-detect from `vercel.json`)
- **Root Directory:** `./` (repo root)
- **Build Command:** Leave default (it will read from `vercel.json`)
- **Output Directory:** Leave default (it will read from `vercel.json`)
- **Install Command:** Leave default

- [ ] **Step 4: Add environment variable**

Expand the "Environment Variables" section. Add:

- **Key:** `VITE_API_BASE_URL`
- **Value:** `https://<your-render-url>.onrender.com/api/v1` (the URL from Task 13 Step 8, with `/api/v1` appended)
- **Environments:** Production (and optionally Preview, Development)

- [ ] **Step 5: Set deploy branch**

In the import form, ensure the production branch is set to `deploy/portfolio` (since you haven't merged to main yet). You can switch this to `main` after the merge in Task 16.

- [ ] **Step 6: Click "Deploy"**

Vercel will run `npm install && npm run build`. Watch the Build Logs tab. Build takes ~2 minutes.

- [ ] **Step 7: Wait for deploy to finish**

Once you see "Your project has been deployed", the frontend is live.

- [ ] **Step 8: Note the Vercel URL**

Save the URL (e.g., `https://financial-ai-insights-engine.vercel.app`). You'll use it in Task 15.

---

## Task 15: Lock down CORS + smoke test

**Files:** None modified — Render config + manual testing

- [ ] **Step 1: Update Render's `FRONTEND_URL` env var**

Render dashboard → your service → Environment tab → find `FRONTEND_URL` → edit value from `*` to your Vercel URL (e.g., `https://financial-ai-insights-engine.vercel.app`). No trailing slash. Save.

- [ ] **Step 2: Wait for redeploy**

Render auto-redeploys when env vars change. Watch the Logs tab; takes ~1 minute. Status returns to "Live".

- [ ] **Step 3: Verify CORS now rejects unknown origins**

Run from local machine:

```bash
curl -v -H "Origin: https://evil.example.com" https://<render-url>/api/v1/companies 2>&1 | grep -i access-control-allow-origin
```

Expected: NO `Access-Control-Allow-Origin: https://evil.example.com` header in response. (May see no Access-Control-Allow-Origin header at all, or one matching the legitimate FRONTEND_URL.)

- [ ] **Step 4: Open Vercel URL in browser**

Open your Vercel URL (from Task 14 Step 8) in a fresh browser window. Open DevTools (F12) → Network tab.

- [ ] **Step 5: Smoke test the golden path**

Click through these flows and verify each works (with the first request ~50s due to Render cold start):

- Home page loads, watchlist visible with default tickers (AAPL, MSFT, NVDA, AMZN, GOOGL, QCOM)
- Search field → type "AAPL" → search results appear → click one → CompanyStats card appears
- Navigate to **Sentiment Reports** (top nav) → enter a ticker → request a report → narrative + drivers + risk flags appear
- **News** → company news for a ticker loads
- **Chatbot** → type "What's the latest on AAPL?" → markdown response appears
- **Reminders** → page loads (creating an actual reminder is optional)

In DevTools Network tab, verify all `/api/v1/...` calls go to your Render URL (not localhost) and return 200.

- [ ] **Step 6: Note any failures**

If any flow fails, common causes:
- 502/503 from Render → cold start in progress, wait 60s and retry
- CORS error → `FRONTEND_URL` doesn't exactly match Vercel URL (check trailing slash, https vs http)
- 500 → check Render Logs tab for the stack trace

---

## Task 16: Merge + cleanup

**Files:** None modified

- [ ] **Step 1: Open pull request**

Go to GitHub → repo → click "Compare & pull request" for branch `deploy/portfolio`. Set base: `main`, compare: `deploy/portfolio`. Title: "Portfolio deploy: Vercel + Render". Self-review the diff.

- [ ] **Step 2: Merge the PR**

Click "Merge pull request" → "Confirm merge". Use a merge commit (not squash) to preserve the 10-commit history.

- [ ] **Step 3: Switch deploy branches in platforms**

In Render: dashboard → service → Settings → Branch → change from `deploy/portfolio` to `main`. Save.

In Vercel: dashboard → project → Settings → Git → Production Branch → change from `deploy/portfolio` to `main`. Save.

Both platforms will run a fresh deploy from `main`. Should be a no-op since the code is identical, but it confirms the production branch is correct.

- [ ] **Step 4: Delete deploy branch**

Run from local machine:

```bash
git checkout main
git pull origin main
git branch -d deploy/portfolio
git push origin --delete deploy/portfolio
```

- [ ] **Step 5: Final verification**

Open your Vercel URL one more time. Smoke test home → sentiment → chatbot. Confirm everything still works after the merge + branch switch.

- [ ] **Step 6: Done**

The app is now deployed. Both URLs auto-deploy from `main` on every push.

---

## Self-Review Notes

The plan was self-reviewed for:

- **Spec coverage:** Every in-scope audit finding (B1–B5, B7, B8, H1–H3, H5, H6, M1–M7, L1, L3, L4) has a corresponding task. Out-of-scope items (B6, H4, L2) are intentionally absent and noted in the spec.
- **Placeholder scan:** No "TBD", "TODO", "implement later", or vague handwaving in any step. Every code change shows the exact before/after.
- **Type consistency:** `VITE_API_BASE_URL` semantics are consistent across api.ts and Chatbot.tsx (both treat it as the full base URL including `/api/v1` suffix). `FRONTEND_URL` semantics are consistent in main.py (single origin string). Function names (`_ensure_nltk`, `_get_news_processor`) are not referenced before they're defined.
