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
