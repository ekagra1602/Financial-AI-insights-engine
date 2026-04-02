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

export interface StockDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Notable moves on the price series (backend + chart markers). */
export interface ChartEvent {
  index: number;
  label: string;
  time: string;
  event_date: string;
  price: number;
  pct_change: number;
}

/** Lazy-fetched news for one calendar day (separate from main news cache). */
export interface StockEventNewsItem {
  event_date: string;
  headline: string | null;
  summary: string | null;
  url: string | null;
  source: string | null;
  from_cache: boolean;
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
  url_hash?: string; // Added for similarity search
}

export interface RelatedArticle {
  id: string;
  headline: string;
  source: string;
  publishedTime: string;
  sentiment: 'positive' | 'negative' | 'neutral';
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

export interface KeyStatistics {
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  average_volume: number | null;
  high_today: number | null;
  low_today: number | null;
  open_price: number | null;
  current_price: number | null;
  prev_close_price: number | null;
  volume: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  name?: string;
  description?: string;
  country?: string;
  currency?: string;
  exchange?: string;
  ipo?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
  logo?: string;
  finnhubIndustry?: string;
}

// Stock Reminder Types
export type ReminderConditionType = 'price_above' | 'price_below' | 'percent_change' | 'time_based' | 'custom';
export type ReminderStatus = 'active' | 'triggered' | 'expired' | 'cancelled';
export interface StockSymbol {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}
// Sentiment Report Types
export type ForecastHorizon = '1D' | '1W' | '1M' | '3M' | '6M';
export type Stance = 'bullish' | 'neutral' | 'bearish';

export interface ForecastQuantiles {
  q10: number;
  q50: number;
  q90: number;
}

export interface ModelBreakdown {
  modelName: string;
  weight: number;
  contribution: number;
}

export interface ReminderCondition {
  type: ReminderConditionType;
  targetPrice?: number;
  percentChange?: number;
  triggerTime?: string;
  customCondition?: string;
}

export interface StockReminder {
  id: string;
  originalText: string;
  ticker: string;
  companyName?: string;
  action: string;
  condition: ReminderCondition;
  status: ReminderStatus;
  createdAt: string;
  triggeredAt?: string;
  currentPrice?: number;
  notes?: string;
}

export interface ReminderAlert {
  id: string;
  reminderId: string;
  ticker: string;
  message: string;
  triggeredAt: string;
  isRead: boolean;
  originalReminder: StockReminder;
}


export interface WatchlistItem {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
}

export interface RiskFlag {
  id: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface RiskDriver {
  id: string;
  factor: string;
  impact: number;
  description: string;
}

export interface SentimentReport {
  ticker: string;
  companyName: string;
  horizon?: ForecastHorizon;
  generatedAt: string;
  forecast: {
    probabilityUp: number;
    expectedReturn: number;
    quantiles: ForecastQuantiles;
    uncertainty: number;
    modelBreakdown: ModelBreakdown[];
  };
  risk: {
    flags: RiskFlag[];
    topDrivers: RiskDriver[];
    confidenceScore: number;
  };
  narrative?: {
    stance: Stance;
    explanation: string;
  };
  recentPrices?: number[];
}

export interface RecentSearch {
  ticker: string;
  companyName: string;
  searchedAt: string;
}
