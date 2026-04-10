-- Chart event tooltips: one Finnhub-linked article per (ticker, calendar day).
-- Run in Supabase SQL editor. Separate from `news_articles` / embeddings pipeline.

CREATE TABLE IF NOT EXISTS stock_event_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    event_date DATE NOT NULL,
    url_hash TEXT NOT NULL,
    headline TEXT,
    summary TEXT,
    source TEXT,
    url TEXT,
    article_datetime BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ticker, event_date)
);

-- Remove legacy column if the table was created with an older migration.
ALTER TABLE stock_event_news DROP COLUMN IF EXISTS pct_change;

CREATE INDEX IF NOT EXISTS idx_stock_event_news_ticker ON stock_event_news (ticker);

ALTER TABLE stock_event_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_event_news_select" ON stock_event_news FOR SELECT USING (true);
CREATE POLICY "stock_event_news_insert" ON stock_event_news FOR INSERT WITH CHECK (true);
CREATE POLICY "stock_event_news_update" ON stock_event_news FOR UPDATE USING (true);
