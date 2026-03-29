-- ============================================================
-- Migration: Add all new tables (run once in Supabase SQL editor)
-- The news_articles table already exists — this only creates new tables.
-- ============================================================

-- 1. Price Bars — Daily
CREATE TABLE IF NOT EXISTS bars_1d (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (symbol, date)
);
CREATE INDEX IF NOT EXISTS idx_bars_1d_symbol ON bars_1d(symbol);
ALTER TABLE bars_1d ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bars_1d_all" ON bars_1d;
CREATE POLICY "bars_1d_all" ON bars_1d FOR ALL USING (true) WITH CHECK (true);

-- 2. Price Bars — Minute
CREATE TABLE IF NOT EXISTS bars_1m (
    symbol TEXT NOT NULL,
    datetime TEXT NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (symbol, datetime)
);
CREATE INDEX IF NOT EXISTS idx_bars_1m_symbol ON bars_1m(symbol);
ALTER TABLE bars_1m ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bars_1m_all" ON bars_1m;
CREATE POLICY "bars_1m_all" ON bars_1m FOR ALL USING (true) WITH CHECK (true);

-- 3. Price Bars — Hourly
CREATE TABLE IF NOT EXISTS bars_1h (
    symbol TEXT NOT NULL,
    datetime TEXT NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (symbol, datetime)
);
CREATE INDEX IF NOT EXISTS idx_bars_1h_symbol ON bars_1h(symbol);
ALTER TABLE bars_1h ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bars_1h_all" ON bars_1h;
CREATE POLICY "bars_1h_all" ON bars_1h FOR ALL USING (true) WITH CHECK (true);

-- 4. Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    added_at TEXT,
    news_notify_count INTEGER DEFAULT 0
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "watchlist_all" ON watchlist;
CREATE POLICY "watchlist_all" ON watchlist FOR ALL USING (true) WITH CHECK (true);

-- 5. Dismissed Notifications
CREATE TABLE IF NOT EXISTS dismissed_notifications (
    notification_id TEXT PRIMARY KEY,
    dismissed_at TEXT
);
ALTER TABLE dismissed_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dismissed_notifications_all" ON dismissed_notifications;
CREATE POLICY "dismissed_notifications_all" ON dismissed_notifications FOR ALL USING (true) WITH CHECK (true);

-- 6. Generated Notifications
CREATE TABLE IF NOT EXISTS generated_notifications (
    id TEXT PRIMARY KEY,
    type TEXT,
    symbol TEXT,
    date TEXT,
    title TEXT,
    message TEXT,
    direction TEXT,
    percent_change DOUBLE PRECISION,
    created_at TEXT,
    articles_json TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_generated_notifications_date ON generated_notifications(date);
ALTER TABLE generated_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "generated_notifications_all" ON generated_notifications;
CREATE POLICY "generated_notifications_all" ON generated_notifications FOR ALL USING (true) WITH CHECK (true);

-- 7. News Briefing Articles (dedup tracking)
CREATE TABLE IF NOT EXISTS news_briefing_articles (
    id TEXT PRIMARY KEY,
    symbol TEXT,
    url_hash TEXT,
    url TEXT,
    date TEXT,
    created_at TEXT
);
ALTER TABLE news_briefing_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_briefing_articles_all" ON news_briefing_articles;
CREATE POLICY "news_briefing_articles_all" ON news_briefing_articles FOR ALL USING (true) WITH CHECK (true);

-- 8. User Settings (single-row, no auth)
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY,
    email TEXT DEFAULT '',
    email_confirmed INTEGER DEFAULT 0,
    email_notifications_enabled INTEGER DEFAULT 0,
    confirmation_code TEXT DEFAULT '',
    updated_at TEXT
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings_all" ON user_settings;
CREATE POLICY "user_settings_all" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default row (safe — skips if already exists)
INSERT INTO user_settings (id, email, email_confirmed, email_notifications_enabled, confirmation_code, updated_at)
VALUES (1, '', 0, 0, '', NOW()::TEXT)
ON CONFLICT (id) DO NOTHING;

-- 9. Alerts (triggered reminder notifications)
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    reminder_id TEXT,
    ticker TEXT,
    message TEXT,
    triggered_at TEXT,
    is_read INTEGER DEFAULT 0
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_all" ON alerts;
CREATE POLICY "alerts_all" ON alerts FOR ALL USING (true) WITH CHECK (true);

-- 10. Reminders
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    original_text TEXT,
    ticker TEXT,
    company_name TEXT,
    action TEXT,
    status TEXT DEFAULT 'active',
    condition_type TEXT,
    target_price DOUBLE PRECISION,
    percent_change DOUBLE PRECISION,
    trigger_time TEXT,
    custom_condition TEXT,
    created_at TEXT,
    triggered_at TEXT,
    current_price DOUBLE PRECISION,
    notes TEXT
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_all" ON reminders;
CREATE POLICY "reminders_all" ON reminders FOR ALL USING (true) WITH CHECK (true);
