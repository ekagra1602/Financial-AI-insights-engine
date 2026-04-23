-- Create the news_articles table
CREATE TABLE IF NOT EXISTS news_articles (
    url_hash TEXT PRIMARY KEY,
    headline TEXT,
    source TEXT,
    url TEXT,
    datetime BIGINT, -- Storing Unix timestamp from Finnhub
    summary TEXT,
    sentiment TEXT,
    tone TEXT,
    keywords TEXT[], -- Array of text for keywords
    ticker TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on ticker to speed up queries filtering by company
CREATE INDEX IF NOT EXISTS idx_news_articles_ticker ON news_articles(ticker);

-- Enable Row Level Security (RLS) is recommended for Supabase
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows public read access (if you want frontend to read directly, though we are using backend)
-- For backend usage with service_role key, RLS is bypassed. 
-- If using anon key from backend, we need policies.
-- Assuming backend uses a key that can write.

-- Policy for reading (anyone can read)
CREATE POLICY "Public articles are viewable by everyone" 
ON news_articles FOR SELECT 
USING (true);

-- Policy for inserting (service role only typically, or authenticated users)
-- Since we are running this from a backend script, we might be using the service_role key 
-- or we need to allow anon insert if that's how the client is configured (less secure).
-- For now, let's allow anon insert for simplicity of the demo if the user uses the anon key in the backend.
CREATE POLICY "Enable insert for authenticated users and anon" 
ON news_articles FOR INSERT 
WITH CHECK (true);

-- Policy for updates
CREATE POLICY "Enable update for users based on email"
ON news_articles FOR UPDATE
USING (true);

-- ============================================================
-- financial_metadata table
-- Stores normalized quarterly/annual financial data per ticker
-- One row per (ticker, period_type, period_key)
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_metadata (
    ticker              TEXT NOT NULL,
    period_type         TEXT NOT NULL,        -- 'quarterly' | 'annual'
    period_key          TEXT NOT NULL,        -- e.g. '2024-Q3' | '2023-FY'
    fiscal_year         INTEGER,
    fiscal_quarter      INTEGER,              -- NULL for annual
    period_end_date     DATE,

    -- Raw normalized financial data (JSONB for schema flexibility)
    financials          JSONB NOT NULL DEFAULT '{}',
    key_metrics         JSONB NOT NULL DEFAULT '{}',
    eps_data            JSONB,

    -- Pre-built structured input for downstream LLM sentiment generation
    llm_input           JSONB NOT NULL DEFAULT '{}',

    fetched_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (ticker, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_financial_metadata_ticker
    ON financial_metadata(ticker);

CREATE INDEX IF NOT EXISTS idx_financial_metadata_period_end_date
    ON financial_metadata(period_end_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_metadata_ticker_period
    ON financial_metadata(ticker, period_end_date DESC);

ALTER TABLE financial_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public financial_metadata viewable by everyone"
ON financial_metadata FOR SELECT USING (true);

CREATE POLICY "Enable insert for financial_metadata"
ON financial_metadata FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for financial_metadata"
ON financial_metadata FOR UPDATE USING (true);

-- ============================================================
-- sentiment_reports table
-- Caches generated sentiment reports per (ticker, horizon)
-- TTL enforced at application layer (24h)
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_reports (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker              TEXT NOT NULL,
    horizon             TEXT NOT NULL,           -- '1D' | '1W' | '1M' | '3M' | '6M'
    stance              TEXT,                    -- 'bullish' | 'neutral' | 'bearish'
    probability_up      FLOAT,
    confidence_score    FLOAT,
    report              JSONB NOT NULL DEFAULT '{}',
    generated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at          TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sentiment_reports_ticker
    ON sentiment_reports(ticker);

CREATE INDEX IF NOT EXISTS idx_sentiment_reports_ticker_horizon
    ON sentiment_reports(ticker, horizon, generated_at DESC);

ALTER TABLE sentiment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sentiment_reports viewable by everyone"
ON sentiment_reports FOR SELECT USING (true);

CREATE POLICY "Enable insert for sentiment_reports"
ON sentiment_reports FOR INSERT WITH CHECK (true);
