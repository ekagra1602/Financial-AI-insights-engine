-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add embedding column to news_articles table. 
-- Using 384 dimensions for all-MiniLM-L6-v2 model.
alter table news_articles add column if not exists embedding vector(384);

-- Create a function to search for similar articles
-- This function will be called via RPC from the Supabase client
create or replace function match_articles (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  url_hash text,
  headline text,
  summary text,
  ticker text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    news_articles.url_hash,
    news_articles.headline,
    news_articles.summary,
    news_articles.ticker,
    1 - (news_articles.embedding <=> query_embedding) as similarity
  from news_articles
  where 1 - (news_articles.embedding <=> query_embedding) > match_threshold
  order by news_articles.embedding <=> query_embedding
  limit match_count;
end;
$$;
