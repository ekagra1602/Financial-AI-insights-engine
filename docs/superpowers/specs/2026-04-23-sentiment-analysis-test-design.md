# Sentiment Analysis & Forecast Reports — Test Design Spec

**Date:** 2026-04-23  
**Scope:** Exhaustive tests for the sentiment analysis and forecast reports feature, plus behavioral non-regression tests for all other features.

---

## 1. File Structure

13 new files added. Existing 42 tests in `Backend/tests/test_sentiment.py` are untouched.

```
Backend/tests/
├── conftest.py                          # shared fixtures (mocked Supabase, mocked AI100, sample report payload)
├── test_sentiment_router.py             # 12 tests: FastAPI route behavior
├── test_financial_data.py               # 13 tests: financial_data_service scoring logic
├── test_sentiment_integration.py        # 8+5 tests: always-on unit integration + skip-if-no-creds live tests
├── test_regression_watchlist.py         # 7 tests: watchlist behavioral non-regression
├── test_regression_news.py              # 9 tests: news behavioral non-regression
├── test_regression_reminders.py         # 12 tests: reminders behavioral non-regression
└── test_regression_notifications.py     # 13 tests: notifications behavioral non-regression

Frontend/
├── src/components/__tests__/
│   ├── SentimentReport.test.tsx         # 17 RTL tests: component rendering & interaction
│   └── SentimentContainer.test.tsx      # 9 RTL tests: data-fetch orchestration
└── e2e/
    ├── sentiment.spec.ts                # 15 Playwright E2E tests: full sentiment feature flow
    └── regression.spec.ts               # 15 Playwright E2E tests: all other features intact
```

---

## 2. Backend Unit Tests

### `Backend/tests/conftest.py`

Shared pytest fixtures available to all test files:

| Fixture | Scope | Purpose |
|---|---|---|
| `sample_report` | function | Full valid `SentimentReport` Pydantic-compatible dict with all fields populated (ticker=AAPL, horizon=1M, bullish stance, quantiles, top_drivers, risk_flags) |
| `mock_supabase` | function | `unittest.mock.patch` on `supabase_client` — pre-configured to return `None` for cache miss, insert success |
| `mock_ai100` | function | `unittest.mock.patch` on `ai100_client.chat_completion` — returns deterministic JSON matching the LLM output format |
| `mock_financial_data` | function | Pre-built `FinancialData` dict with all 8 completeness fields populated |
| `async_client` | function | `httpx.AsyncClient` with `ASGITransport(app=app)` from `main.py` — no live server required |

### `Backend/tests/test_sentiment_router.py` — 12 tests

**`TestGetSentimentReport`** (7 tests):
1. `test_returns_cached_report_when_fresh` — mock Supabase returns a report not yet expired; router returns 200 with `cache_hit=true`, LLM is never called
2. `test_cache_miss_triggers_generation` — mock Supabase returns `None`; router calls `SentimentEngine.generate_report`; asserts 200 and all required top-level fields present (`ticker`, `horizon`, `forecast`, `risk`, `narrative`, `generatedAt`)
3. `test_force_refresh_bypasses_cache` — Supabase has a fresh cached report; `?force_refresh=true` skips it; new report generated and saved
4. `test_invalid_ticker_symbol_raises_422` — `GET /api/v1/sentiment/TOOLONGVALUE` returns 422 (FastAPI path param validation)
5. `test_missing_ticker_returns_404_or_422` — `GET /api/v1/sentiment/` returns 404 (no route match)
6. `test_all_horizon_values_accepted` — parametrize over `['1D','1W','1M','3M','6M']`; each returns 200 with `horizon` matching the request
7. `test_invalid_horizon_returns_422` — `?horizon=5Y` returns 422

**`TestIngestEndpoint`** (3 tests):
8. `test_ingest_stores_financial_metadata` — POST `/api/v1/sentiment/ingest/AAPL`; mock Finnhub + Supabase; asserts `financial_metadata` upsert called once
9. `test_ingest_returns_ticker_and_status` — response body has `ticker` and `status: "ok"`
10. `test_ingest_handles_finnhub_failure_gracefully` — mock Finnhub raises `httpx.HTTPError`; endpoint returns 502, not 500

**`TestLLMInputEndpoint`** (2 tests):
11. `test_llm_input_returns_prompt_string` — GET `/api/v1/sentiment/llm-input/AAPL`; mock `financial_data_service`; response has `llm_input` key with non-empty string
12. `test_llm_input_missing_data_returns_empty_string` — Supabase returns no financial_metadata rows; response has empty `llm_input`

### `Backend/tests/test_financial_data.py` — 13 tests

**`TestFCFCalculation`** (2 tests):
1. `test_fcf_positive_when_capex_negative` — `operating_cf=500, capex=-200` → FCF=300. Finnhub reports capex as negative; addition (not subtraction) gives correct result.
2. `test_fcf_negative_when_large_capex` — `operating_cf=100, capex=-400` → FCF=-300

**`TestRangePosition`** (3 tests):
3. `test_range_position_midpoint` — `price=150, low=100, high=200` → 50.0
4. `test_range_position_clamped_above_100` — `price=210, low=100, high=200` → 100.0
5. `test_range_position_clamped_below_0` — `price=90, low=100, high=200` → 0.0

**`TestDataCompletenessPercent`** (3 tests):
6. `test_completeness_all_8_fields_present` → 100.0
7. `test_completeness_4_of_8_fields` → 50.0
8. `test_completeness_zero_fields` → 0.0

**`TestFinnhubFieldMapping`** (2 tests):
9. `test_roa_reads_roa5y_key` — Finnhub metric key `roa5Y` maps to `roa_5y` in financial_metadata; assert the ingested value from `roa5Y` appears under `roa_5y`
10. `test_roa_not_roa_ttm` — assert `roa_ttm` key is NOT used; passing a dict with `roa_ttm` but not `roa5Y` results in `roa_5y=None`

**`TestFreshnessCheck`** (3 tests):
11. `test_fresh_data_skips_refetch` — `updated_at` within 7 days; `ingest_ticker` does NOT call Finnhub
12. `test_stale_data_triggers_refetch` — `updated_at` 8 days ago; Finnhub called
13. `test_missing_data_triggers_fetch` — no row in financial_metadata; Finnhub called

---

## 3. Backend Integration Tests

### `Backend/tests/test_sentiment_integration.py`

**`TestSentimentUnitIntegration`** — 8 tests, always runs (no live services):

| # | Name | What it verifies |
|---|---|---|
| 1 | `test_full_report_shape` | `generate_report("AAPL","1M")` with all mocks → response has all 12 required top-level keys |
| 2 | `test_score_weights` | final `sentimentScore = 0.55×financial + 0.45×news` (±0.5 tolerance) |
| 3 | `test_confidence_is_deterministic` | same inputs always produce same `confidenceScore` (call twice, assert equal) |
| 4 | `test_news_score_2_tuple_contract` | `_compute_news_score` returns exactly a 2-tuple; `self._last_article_count` set afterward |
| 5 | `test_cache_write_on_generation` | Supabase `upsert` called once with correct `expires_at` ~24h from now |
| 6 | `test_force_refresh_skips_read` | Supabase `select` for cache NOT called when `force_refresh=True` |
| 7 | `test_horizon_affects_news_lookback` | `1D` → lookback=1 day; `6M` → lookback=180 days (assert the date window passed to `get_recent_articles`) |
| 8 | `test_generate_report_is_async` | `generate_report` is a coroutine (check `asyncio.iscoroutinefunction`) |

**`TestSentimentLiveIntegration`** — 5 tests, auto-skipped unless all 4 env vars present (`FINNHUB_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `AI100_API_KEY`):

```python
pytestmark = pytest.mark.skipif(
    not all([os.getenv(v) for v in ["FINNHUB_API_KEY","SUPABASE_URL","SUPABASE_KEY","AI100_API_KEY"]]),
    reason="Live credentials not configured"
)
```

| # | Name | What it verifies |
|---|---|---|
| L1 | `test_live_ingest_aapl` | Ingests AAPL; Supabase has a `financial_metadata` row within 10s |
| L2 | `test_live_generate_report` | Calls `generate_report("AAPL","1M")` against real services; all 12 keys present, score in [0,100] |
| L3 | `test_live_cache_hit` | Generate report twice; second call returns `cache_hit=True` |
| L4 | `test_live_report_endpoint` | GET `/api/v1/sentiment/AAPL` returns 200 with well-formed JSON |
| L5 | `test_live_force_refresh` | GET `/api/v1/sentiment/AAPL?force_refresh=true` returns fresh report with `generatedAt` ≥ first |

---

## 4. Frontend Vitest + RTL Tests

**Setup:** `vitest`, `@testing-library/react`, `@testing-library/user-event`, `msw` for API mocking. All tests run under `jsdom`.

### `Frontend/src/components/__tests__/SentimentReport.test.tsx` — 17 tests

**`describe("SentimentReport rendering")`** — 10 tests:
1. `renders_skeleton_when_loading_true` — `isLoading=true` → `<ReportSkeleton>` in DOM, no ticker text
2. `renders_loading_spinner_when_report_null` — `isLoading=false, report=null` → loading spinner present
3. `renders_company_name_and_ticker` — report.companyName="Apple Inc.", ticker="AAPL" → both in DOM
4. `renders_bullish_stance_with_correct_color` — stance=bullish → `text-positive` class on stance badge
5. `renders_bearish_stance_with_correct_color` — stance=bearish → `text-negative` class
6. `renders_neutral_stance` — stance=neutral → `text-text-secondary` class, Minus icon
7. `renders_sentiment_score_with_progress_bar` — sentimentScore=72.5 → "72.5/100" text; progress bar width=72.5%
8. `renders_expected_return_positive` — expectedReturn=8.5 → "+8.50%" with `text-positive`
9. `renders_expected_return_negative` — expectedReturn=-3.2 → "-3.20%" with `text-negative`
10. `renders_quantile_bars_for_forecast_range` — q10=-2, q50=5, q90=12 → 3 bars; widths normalized to maxAbs=12

**`describe("SentimentReport interactions")`** — 7 tests:
11. `horizon_buttons_all_five_rendered` — 1D, 1W, 1M, 3M, 6M all in DOM
12. `default_horizon_1M_is_selected` — 1M button has `bg-primary` class on initial render
13. `clicking_horizon_calls_onHorizonChange` — click "1W" → `onHorizonChange` called with "1W"
14. `selected_horizon_syncs_with_report_ticker_change` — change report.ticker from AAPL to TSLA with report.horizon="1W" → "1W" button becomes active
15. `refresh_button_calls_onRefresh` — click "Refresh Report" → `onRefresh` called once
16. `top_drivers_rendered_when_present` — 2 drivers in report.risk.topDrivers → 2 driver cards in DOM
17. `risk_flags_rendered_with_severity_class` — 1 high-severity flag → `border-negative` class on flag card

### `Frontend/src/components/__tests__/SentimentContainer.test.tsx` — 9 tests

Uses MSW handlers for `/api/v1/sentiment/:ticker` and `/api/v1/sentiment/ingest/:ticker`.

1. `shows_ticker_input_on_initial_render` — no `?ticker` param → input visible, no report rendered
2. `populates_ticker_from_url_param` — render with `?ticker=AAPL` → fetch triggered with AAPL
3. `renders_report_on_successful_fetch` — MSW returns sample_report → SentimentReport component in DOM
4. `shows_error_on_api_failure` — MSW returns 500 → error message rendered
5. `shows_loading_state_during_fetch` — MSW delays 200ms → skeleton rendered before response
6. `horizon_change_triggers_new_fetch` — click "1W" → second fetch with `horizon=1W`
7. `force_refresh_adds_query_param` — click "Refresh Report" → fetch URL contains `force_refresh=true`
8. `five_minute_client_cache_prevents_redundant_fetch` — fetch same ticker twice within 5min → fetch called once
9. `cache_bypassed_on_force_refresh` — fetch, then force_refresh → fetch called twice for same ticker

---

## 5. Playwright E2E Tests

**Config:** `playwright.config.ts` with `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`. Base URL `http://localhost:3000`.

### `Frontend/e2e/sentiment.spec.ts` — 15 tests

**`describe("Sentiment page navigation")`** (3 tests):
1. `navigates_to_sentiment_from_header` — click "Sentiment Reports" nav link → URL = `/sentiment-reports`
2. `sentiment_page_shows_ticker_input` — `/sentiment-reports` → input with placeholder visible
3. `url_param_prepopulates_search` — navigate to `/sentiment-reports?ticker=AAPL` → AAPL in input

**`describe("Sentiment report generation")`** (6 tests):
4. `entering_ticker_and_submitting_shows_loading` — type "AAPL", press Enter → loading skeleton appears
5. `report_renders_company_name` — after report loads → "Apple" visible in DOM
6. `all_five_horizon_buttons_visible` — 1D, 1W, 1M, 3M, 6M all visible
7. `changing_horizon_updates_report` — click "1W" → page shows loading state then new report
8. `refresh_button_visible_and_clickable` — "Refresh Report" button → clickable, triggers loading
9. `sentiment_score_displayed_with_progress_bar` — score text matches `/\d+(\.\d+)?\/100/` regex

**`describe("Sentiment report content")`** (3 tests):
10. `stance_badge_rendered` — one of "bullish", "bearish", "neutral" visible (case-insensitive)
11. `forecast_range_section_visible` — "Forecast Range" heading in DOM
12. `analysis_summary_section_visible` — "Analysis Summary" heading in DOM

**`describe("Sentiment error states")`** (3 tests):
13. `invalid_ticker_shows_error` — type "INVALIDXYZ999", submit → error message rendered (not a crash)
14. `empty_ticker_submit_does_nothing` — submit empty → no report rendered, no crash
15. `network_error_shows_friendly_message` — intercept route → 500 → user-visible error message

### `Frontend/e2e/regression.spec.ts` — 15 tests

**`describe("Homepage non-regression")`** (3 tests):
1. `homepage_loads_without_crash` — `/` → no console errors, header visible
2. `watchlist_renders_items` — at least one watchlist item card visible
3. `stock_chart_loads` — StockChart component renders (chart container in DOM)

**`describe("News page non-regression")`** (3 tests):
4. `news_page_loads` — `/news` → page title or heading visible, no crash
5. `news_filter_sidebar_visible` — watchlist filter sidebar rendered on `/news`
6. `news_card_renders` — at least one news card in DOM (or "no articles" state — not a crash)

**`describe("Reminders page non-regression")`** (3 tests):
7. `reminders_page_loads` — `/reminders` → no crash, reminder input visible
8. `reminder_input_accepts_text` — type in natural language input → text appears
9. `alerts_panel_renders` — alerts panel heading visible (even if empty)

**`describe("Chatbot non-regression")`** (2 tests):
10. `chatbot_page_loads` — `/chatbot` → chat UI visible, no crash
11. `chatbot_responds_to_message` — type "What is AAPL?" → response appears (mock response, no real API)

**`describe("Header and notification non-regression")`** (2 tests):
12. `header_renders_on_all_pages` — check header present on `/`, `/news`, `/reminders`, `/chatbot`, `/sentiment-reports`
13. `notification_bell_clickable` — click bell icon → notification panel opens

**`describe("Routing non-regression")`** (2 tests):
14. `all_nav_links_navigate_correctly` — each nav link loads correct page (no 404, no crash)
15. `url_param_ticker_on_sentiment_works` — `/sentiment-reports?ticker=AAPL` → ticker visible in input

---

## 6. Backend Behavioral Non-Regression Tests

All 4 files use `httpx.AsyncClient(app=app, base_url="http://test")`. All external calls (Finnhub, Supabase, AI100) are mocked. No live server required.

### `Backend/tests/test_regression_watchlist.py` — 7 tests

1. `test_get_watchlist_returns_list` — GET `/api/v1/watchlist` → 200, response is JSON array
2. `test_add_ticker_to_watchlist` — POST `/api/v1/watchlist` `{ticker:"MSFT"}` → 200/201, ticker in watchlist
3. `test_duplicate_add_does_not_crash` — POST same ticker twice → second call returns 200 (not 500)
4. `test_remove_ticker_from_watchlist` — DELETE `/api/v1/watchlist/MSFT` → 200, ticker absent on subsequent GET
5. `test_watchlist_enriched_with_price` — mock Finnhub quote returns price=150; GET watchlist → each item has `price` field
6. `test_news_notify_toggle` — PATCH `/api/v1/watchlist/{ticker}/notify` → 200, `news_notify_count` updates
7. `test_watchlist_empty_list_ok` — GET on empty watchlist → 200, empty array (not 404 or crash)

### `Backend/tests/test_regression_news.py` — 9 tests

1. `test_company_news_returns_list` — GET `/api/v1/news/AAPL` → 200, array of articles
2. `test_company_news_articles_have_required_fields` — each article has `headline`, `url`, `datetime`, `sentiment`
3. `test_market_news_returns_list` — GET `/api/v1/news/market` → 200, non-empty array
4. `test_similar_news_requires_valid_url_hash` — GET `/api/v1/news/similar/BADHASH` → 404 or empty array (not crash)
5. `test_similar_news_returns_cosine_similar_articles` — mock pgvector RPC returns 3 articles; response has 3 items with `similarity` field
6. `test_news_briefing_toggle_on` — POST `/api/v1/news-briefing/toggle` `{enabled:true}` → 200
7. `test_news_briefing_toggle_off` — POST `{enabled:false}` → 200
8. `test_news_briefing_generate_returns_articles` — POST `/api/v1/news-briefing/generate` → mock returns 3 articles; response has `articles` array
9. `test_ticker_search_returns_matches` — GET `/search?q=Apple` → 200, results with `symbol` and `description` fields

### `Backend/tests/test_regression_reminders.py` — 12 tests

1. `test_get_reminders_returns_list` — GET `/api/v1/reminders` → 200, array
2. `test_create_reminder_natural_language` — POST `/api/v1/reminders` `{text:"Alert me when AAPL hits $200"}` → 200, reminder created with `ticker="AAPL"`, `condition.type="price_above"`, `condition.target_price=200`
3. `test_create_reminder_price_below` — "Alert me when TSLA drops below $150" → `condition.type="price_below"`, target=150
4. `test_create_reminder_percent_change` — "Alert me when AAPL rises 10%" → `condition.type="percent_change"`, percent=10
5. `test_derive_target_price_for_percent` — percent_change=10, current_price=100 → target_price=110.0
6. `test_create_reminder_time_based` — "Remind me about MSFT in 2 hours" → `condition.type="time_based"`
7. `test_delete_reminder` — DELETE `/api/v1/reminders/{id}` → 200, reminder absent on GET
8. `test_get_alerts_returns_list` — GET `/api/v1/alerts` → 200, array
9. `test_alert_has_required_fields` — each alert has `id`, `ticker`, `message`, `triggered_at`, `is_read`
10. `test_dismiss_alert` — POST `/api/v1/alerts/{id}/dismiss` → 200, `is_read=true` on re-fetch
11. `test_duplicate_reminder_same_ticker_ok` — create two reminders for AAPL → both present, no conflict
12. `test_reminder_ticker_normalization` — "apple" in text → ticker normalized to "AAPL"

### `Backend/tests/test_regression_notifications.py` — 13 tests

1. `test_get_notifications_returns_list` — GET `/api/v1/notifications` → 200, array
2. `test_notifications_include_reminder_alerts` — mock alerts table has 1 alert; notifications list includes it as `REMINDER_ALERT` type
3. `test_reminder_alerts_appear_first` — alerts listed before market notifications
4. `test_eod_notification_has_required_fields` — `DAILY_EOD` type item has `id`, `type`, `message`, `ticker`, `timestamp`
5. `test_momentum_notification_has_required_fields` — `MOMENTUM_2H` item has correct fields
6. `test_morning_gap_notification_has_required_fields` — `MORNING_GAP` item has correct fields
7. `test_news_briefing_notification_has_required_fields` — `NEWS_BRIEFING` item has `articles` field
8. `test_dismiss_notification` — POST `/api/v1/notifications/{id}/dismiss` → 200; subsequent GET excludes that id
9. `test_get_email_settings_returns_object` — GET `/api/v1/account/settings` (or equivalent) → 200, has `email`, `confirmed`, `notifications_enabled`
10. `test_update_email_settings` — PUT with new email → 200, returned email matches
11. `test_notification_id_format_for_briefing` — briefing notification id matches pattern `{TICKER}_NEWS_{YYYY-MM-DD}_10AM`
12. `test_market_news_notification_not_from_briefing_router` — `DAILY_EOD`, `MOMENTUM_2H`, `MORNING_GAP` do NOT originate from news_briefing router (service isolation check via mock call counts)
13. `test_empty_watchlist_returns_empty_notifications` — empty watchlist → notifications array is empty or only alert-sourced (no market event notifications)

---

## Implementation Constraints

### Backend
- All new tests placed in `Backend/tests/`
- `conftest.py` is a new file; existing `tests/__init__.py` stays empty
- Use `unittest.mock.patch` and `AsyncMock` for all external calls
- Integration tests use `@pytest.mark.skipif` on all 4 credentials (fail-open: skip, not fail)
- Run all new backend tests: `python -m pytest Backend/tests/ -v` (runs 42 existing + all new tests)

### Frontend
- Vitest config added to `vite.config.ts` or separate `vitest.config.ts`
- MSW handlers in `Frontend/src/__tests__/mocks/handlers.ts`
- Playwright config at `Frontend/playwright.config.ts`
- Run component tests: `npm run test` (Vitest)
- Run E2E tests: `npx playwright test` (requires `npm run dev` running or `webServer` config)

### Critical invariants that must not be broken
- `_compute_news_score` returns a 2-tuple only — tests verify this
- `tool_choice:"none"` present in every AI100 mock assertion
- Supabase `datetime` comparisons use Unix BIGINT (not ISO strings) in assertions
- FCF test asserts addition, not subtraction

---

## Test Count Summary

| File | Tests | Runs Offline? |
|---|---|---|
| `test_sentiment_router.py` | 12 | Yes |
| `test_financial_data.py` | 13 | Yes |
| `test_sentiment_integration.py` | 8 always + 5 skip-if-no-creds | Yes (8 always) |
| `test_regression_watchlist.py` | 7 | Yes |
| `test_regression_news.py` | 9 | Yes |
| `test_regression_reminders.py` | 12 | Yes |
| `test_regression_notifications.py` | 13 | Yes |
| `SentimentReport.test.tsx` | 17 | Yes |
| `SentimentContainer.test.tsx` | 9 | Yes |
| `sentiment.spec.ts` (Playwright) | 15 | Requires dev server |
| `regression.spec.ts` (Playwright) | 15 | Requires dev server |
| **Total new tests** | **135** | — |
| Existing `test_sentiment.py` | 42 | Yes (unchanged) |
| **Grand total** | **177** | — |
