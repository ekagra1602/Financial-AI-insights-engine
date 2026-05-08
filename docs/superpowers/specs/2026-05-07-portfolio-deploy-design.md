# Portfolio Deploy Design

**Date:** 2026-05-07
**Goal:** Deploy the Financial AI Insights Engine as a polished portfolio piece on Vercel (frontend) + Render (backend), with all in-scope audit findings fixed.

---

## 1. Context

The repo was audited for production readiness and 25 issues were identified across blockers (B1–B8), high-priority (H1–H6), medium-priority (M1–M7), and low-priority cleanup (L1–L4). Two architectural facts drive the deploy plan:

1. **Vercel cannot host the backend.** It is a stateful FastAPI app with asyncio fire-and-forget tasks, module-level singletons, ~290 MB of dependencies (newspaper3k, lxml, pandas, plotly, supabase, twelvedata), and an `nltk.download` at import. The serverless model does not support any of this.
2. **The frontend is a static SPA** that builds cleanly and fits Vercel's hosting model natively.

The deploy splits frontend onto Vercel and backend onto Render (free tier).

## 2. Goal & Scope

**Audience:** Portfolio piece for resume. Public URL that recruiters may click occasionally. No real users.

**Budget:** Free tier only. Render free spins down after 15 min idle (~50s cold start on first hit) — acceptable trade-off.

**Scope:** "Polished portfolio quality" — every audit finding fixed except:

- **B6** — auth and rate limiting (intentionally accepted risk)
- **H4** — test suite repair (not visible to reviewers; conftest.py is unused dead path)
- **L2** — backend logging refactor (200+ `print()` → `logging`; deferred)

Everything else (B1–B5, B7, B8, H1–H3, H5, H6, M1–M7, L1, L3, L4) is in scope.

## 3. Architecture

```
                         ┌────────────────────────────┐
       Recruiter         │   Vercel (Hobby, free)     │
       opens public  ──▶ │   Static SPA from Vite     │
       URL               │   (Frontend/dist)          │
                         └────────┬───────────────────┘
                                  │ fetch
                                  │ VITE_API_BASE_URL
                                  ▼
                         ┌────────────────────────────┐
                         │   Render (free tier)       │
                         │   Docker container:        │
                         │   uvicorn main:app         │
                         │   Spins down after 15min   │
                         └────────┬───────────────────┘
                                  │
                  ┌───────────────┼─────────────────┐
                  ▼               ▼                 ▼
           Supabase        Finnhub / TwelveData   AI100 (Cirrascale)
           (existing)      (existing API keys)    (existing API key)
```

Two new hosting accounts (Vercel + Render). Existing accounts (Supabase, Finnhub, TwelveData, AI100, Resend) keep their current keys.

## 4. Code Changes (10 atomic commits on branch `deploy/portfolio`)

### Commit 1 — Frontend env-driven API base URL (B1, B7, B8, H6)

| File | Change |
|---|---|
| `Frontend/src/services/api.ts:3,471` | Replace both hardcoded URLs with `import.meta.env.VITE_API_BASE_URL` (with `http://127.0.0.1:8000/api/v1` fallback for local dev) |
| `Frontend/src/components/Chatbot.tsx:43-51` | Drop relative `/api/v1/chat` candidate; keep only env-var URL |
| `Frontend/src/components/Chatbot.tsx:305` | Replace user-visible `127.0.0.1:8000` error with generic "couldn't reach the chat service" |
| `Frontend/.env.example` (new) | Document `VITE_API_BASE_URL` with example value |

### Commit 2 — Hide WebSearch + delete dead frontend components (L1)

| File | Change |
|---|---|
| `Frontend/src/router.tsx` | Remove `/web-search` route |
| `Frontend/src/components/Header.tsx:48` | Remove WebSearch nav entry |
| `Frontend/src/components/WebSearch.tsx` | Delete (demo-only static data) |
| `Frontend/src/components/SentimentHome.tsx` | Delete (unused) |
| `Frontend/src/components/NewsFeed.tsx` | Delete (unused) |
| `Frontend/src/data/demoData.ts` | Delete (only referenced by deleted files) |

`Frontend/src/data/newsData.ts` is kept (still used by NewsPage as fallback).

### Commit 3 — Vite production optimizations + vercel.json (B2, M2, M6)

| File | Change |
|---|---|
| `Frontend/vite.config.ts` | Add `build.rollupOptions.output.manualChunks` to split plotly into its own chunk; add `esbuild.pure: ['console.log']` to drop debug logs in prod (keep `console.error`/`console.warn`) |
| `Frontend/src/pages/HomePage.tsx` (and other StockChart consumers) | Wrap StockChart in `React.lazy()` + `<Suspense>` for deferred load |
| `vercel.json` (new, repo root) | Build config: `buildCommand: "cd Frontend && npm install && npm run build"`, `outputDirectory: "Frontend/dist"`, SPA rewrite `/(.*)` → `/index.html` |

### Commit 4 — Backend security and correctness (B4, H1, H3, M3, M5, M7)

| File | Change |
|---|---|
| `Backend/main.py:29-35` | Replace `allow_origins=["*"]` with `[os.getenv("FRONTEND_URL", "http://localhost:3000")]` |
| `Backend/services/financial_data_service.py:163` | Replace deprecated `datetime.utcnow()` with `datetime.now(datetime.timezone.utc)` |
| `Backend/services/finnhub_client.py:38,46,54,62,75,107,114,124` | Add `timeout=20` to every `requests.get()` |
| `Backend/services/ai100_client.py:267-285,481-487` | Add `"tool_choice": "none"` to the two payloads missing it (`analyze_text`, `_call_chat_completion`) |
| `Backend/services/ai100_client.py:72,134,302` | Drop `response.text[:N]` from log lines — log status code only |
| `Backend/services/price_monitor.py:36-40` | Fix naive-vs-aware datetime comparison: parse `trig_t`, normalize to UTC, compare against `datetime.now(timezone.utc)` |

### Commit 5 — Backend production-ready Dockerfile (B3)

| File | Change |
|---|---|
| `Backend/Dockerfile` | Drop `--reload`. Switch CMD to shell-form so Render's `$PORT` env var resolves: `CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |

### Commit 6 — Lazy NLTK download (M4)

| File | Change |
|---|---|
| `Backend/services/news_processor.py:9-13` | Move `nltk.download('punkt')` out of module top-level into a `_ensure_nltk()` helper called from `_scrape_content` only when needed. Prevents the import-time network call. |

### Commit 7 — News briefing dedup ID rename (L3)

| File | Change |
|---|---|
| `Backend/routers/news_briefing.py` | Change dedup ID from `f"{symbol}_NEWS_{today_str}_10AM"` to `f"{symbol}_NEWS_{today_str}"` (one briefing per symbol per day, regardless of trigger time) |

### Commit 8 — Pin requirements (M1)

| File | Change |
|---|---|
| `Backend/requirements.txt` | Replace unpinned list with `pip freeze` output from current working venv. Adds version pins for direct + transitive deps |

### Commit 9 — Delete dead backend code (L1, L4)

Delete: `Backend/app/`, `Backend/temp_ai100_main.py`, `Backend/test_chat_news.py`, `Backend/test_search.py`, `Backend/test_db_similarity.py`, `Backend/test_similarity.py`, `.github/java-upgrade/`, root `package-lock.json`. Also delete `Backend/stock_data.db` locally (gitignored, no commit needed). Resolves L4 implicitly (root-level test scripts gone → pytest discovery clean).

### Commit 10 — Docs (H5, H2, plus DEPLOY.md)

| File | Change |
|---|---|
| `CLAUDE.md` | Rewrite database section (Supabase, not SQLite); update Chatbot section (wired, not mock); update file map (remove deleted files); add note about news briefing ID change |
| `Backend/.env.example:17` | Fix `AI100_MODEL=Llama-3.1-8B` → `AI100_MODEL=DeepSeek-R1-Distill-Llama-70B` |
| `DEPLOY.md` (new) | Step-by-step deploy guide for Render + Vercel; includes SUPABASE_KEY-must-be-service-role verification |

## 5. Configuration

### Render (backend) env vars

| Variable | Source / Value |
|---|---|
| `FINNHUB_API_KEY` | Copy from local `Backend/.env` |
| `SUPABASE_URL` | Copy from local `Backend/.env` |
| `SUPABASE_KEY` | Service role key (already verified) |
| `AI100_API_KEY` | Copy from local `Backend/.env` |
| `AI100_BASE_URL` | `https://aisuite.cirrascale.com/apis/v2` |
| `AI100_MODEL` | `DeepSeek-R1-Distill-Llama-70B` |
| `TWELVE_DATA_API_KEY` | Copy from local `Backend/.env` |
| `RESEND_API_KEY` | New key with Sending access scope only |
| `FRONTEND_URL` | Vercel URL (set after Vercel deploy in Phase 4) |
| `PORT` | Auto-set by Render |

### Render service settings

- Service type: Web Service
- Runtime: Docker (auto-detected from `Backend/Dockerfile`)
- Root directory: `Backend/`
- Region: Oregon (free)
- Plan: Free
- Health check path: `/`

### Vercel (frontend) env vars

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<render-service>.onrender.com/api/v1` |

### Vercel project settings

- Framework preset: Vite (auto-detected from `vercel.json`)
- Root directory: `./`
- Build/output: defined in `vercel.json`

### Local dev

No change required. `Backend/.env` keeps current values plus `FRONTEND_URL=http://localhost:3000` for local CORS. Frontend `api.ts` falls back to `http://127.0.0.1:8000/api/v1` when `VITE_API_BASE_URL` is unset, so no `.env` needed locally.

## 6. Deploy Sequence

### Phase 1 — Local code changes (~6h)

1. `git checkout -b deploy/portfolio`
2. Execute commits 1–10 in order
3. Local verification:
   - `cd Frontend && npm run build` succeeds; `dist/` shows separate plotly chunk
   - `cd Frontend && npm run dev` + `cd Backend && uvicorn main:app --reload` — app works against localhost
   - Manual smoke: home → search ticker → news → sentiment → chatbot → reminders
4. `git push -u origin deploy/portfolio`

### Phase 2 — Backend deploy to Render (~30 min)

1. Render dashboard → New Web Service → connect GitHub → repo + `deploy/portfolio` branch
2. Settings: Root `Backend/`, Docker, Free plan, Oregon
3. Add all env vars from Section 5; set `FRONTEND_URL=*` temporarily
4. Deploy (~5 min build)
5. Verify: `curl https://<service>.onrender.com/` returns JSON greeting
6. Note Render URL

### Phase 3 — Frontend deploy to Vercel (~15 min)

1. Vercel dashboard → New Project → import repo
2. Root: `./`, framework auto-detected from `vercel.json`
3. Add `VITE_API_BASE_URL=https://<render-url>/api/v1`
4. Branch: `deploy/portfolio`
5. Deploy (~2 min)
6. Note Vercel URL

### Phase 4 — Lock down CORS + smoke test (~15 min)

1. Render → service → Environment → set `FRONTEND_URL` to Vercel URL (no trailing slash); auto-redeploys
2. Open Vercel URL in browser with DevTools open
3. Smoke test golden path: home → ticker search → sentiment report → news → chatbot → reminders
4. CORS lockdown sanity: `curl -H "Origin: https://evil.example.com" https://<render-url>/api/v1/companies` should not return `Access-Control-Allow-Origin`

### Phase 5 — Merge + cleanup (~5 min)

1. Open PR `deploy/portfolio` → `main`, self-review, merge
2. Render + Vercel: switch deploy branch to `main`
3. Delete `deploy/portfolio` branch

**Total: ~7 hours (6h code + 1h deploy)**

## 7. Failure Modes & Rollback

### Rollback options

| When | What to do |
|---|---|
| Mid-Phase 1 (local) | `git reset --hard` or `git checkout main` |
| After Phase 2 (backend live, frontend not) | Render → suspend service. No external traffic. |
| After Phase 3 (both live, broken) | Vercel → Deployments → previous deployment → Promote to Production |
| After Phase 5 (merged, broken in prod) | `git revert <merge-commit>`, push to main, auto-deploys previous state |

### Common failure modes

- **Render 502 after deploy** → port mismatch. Verify Commit 5 Dockerfile uses shell-form CMD with `${PORT:-8000}`.
- **Vercel pages 404** → SPA rewrite missing in `vercel.json`.
- **CORS error in browser** → `FRONTEND_URL` env var doesn't exactly match Vercel URL (check trailing slash, protocol).
- **First request takes 50s** → expected cold start on Render free.
- **Sentiment report timeout** → AI100 occasional slow response; frontend has 90s timeout. Repeat the request.
- **Chatbot hits relative URL** → Commit 1's drop of relative `/api/v1/chat` was incomplete; re-verify.

### Post-deploy expectations

- Cold start every 15 min idle is normal on Render free
- Resend free tier: 100 emails/day (unlikely to hit for portfolio)
- AI100 / Finnhub quotas shared with dev account; watch for 429s in Render logs

## 8. Open Questions / Out of Scope

The following are explicitly deferred and not part of this deploy:

- **Auth and rate limiting (B6)** — accepted risk. The app is single-user-by-design; recruiters can write to your watchlist or reminders. Acceptable for portfolio.
- **Test suite repair (H4)** — `tests/conftest.py` references a non-existent `database.DB_PATH`. Tests using the broken fixtures fail silently. Not visible to reviewers.
- **Backend logging refactor (L2)** — 200+ `print()` calls remain. Render's log viewer still works, just unstructured.

If a future iteration adds real users, B6 must be addressed before going public.
