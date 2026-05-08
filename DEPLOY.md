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
- Navigate to **Sentiment Reports** → request a report (note: first call will be ~50s while Render cold-starts; subsequent calls fast)
- **News** page loads articles
- **Chatbot** — type "what's the latest on AAPL?" → response comes back
- **Reminders** — page loads (creating a reminder optional but recommended)

If anything breaks, check Render logs (dashboard → service → Logs) and browser DevTools Network tab.

## Notes

- Render free tier spins down after 15 min idle. First request after sleep takes ~50s. Subsequent requests are fast.
- AI100 / Finnhub / TwelveData quotas are shared with your dev environment. Watch Render logs for 429s.
- Resend free tier: 100 emails/day.
- Auth is intentionally absent — anyone hitting the public URL can write to your watchlist, create reminders, and trigger emails. Acceptable for portfolio use.
