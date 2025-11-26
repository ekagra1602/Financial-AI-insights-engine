export interface StockData {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  shares?: number;
  sparklineData: number[];
}

export interface PortfolioDataPoint {
  timestamp: number;
  value: number;
}

export interface NewsArticle {
  id: string;
  source: string;
  timeAgo: string;
  title: string;
  ticker?: string;
  change?: number;
  imageUrl?: string;
}

export interface SummarizedNewsArticle {
  id: string;
  headline: string;
  source: string;
  publishedTime: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  tone: 'bullish' | 'bearish' | 'neutral';
  keywords: string[];
  url: string;
  ticker: string;
}

export interface RelatedArticle {
  id: string;
  headline: string;
  source: string;
  publishedTime: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  tone?: 'bullish' | 'bearish' | 'neutral';
  ticker?: string;
  url: string;
  relationContext?: string;
}

export interface DailyMover {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

export type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

