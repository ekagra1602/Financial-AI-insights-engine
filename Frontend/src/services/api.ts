import { KeyStatistics, StockSymbol } from "../types";

const API_BASE_URL = "http://localhost:8000/api/v1";

// ===== Frontend In-Memory Cache =====
const CACHE_TTL_MS = 120_000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const historyCache = new Map<string, CacheEntry<any[]>>();
const statsCache = new Map<string, CacheEntry<KeyStatistics>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ===== API Functions =====

export const searchStocks = async (
  query: string
): Promise<{ count: number; result: StockSymbol[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/search?q=${query}`);
    if (!response.ok) {
      throw new Error("Failed to search stocks");
    }
    return await response.json();
  } catch (error) {
    console.error("Error searching stocks:", error);
    return { count: 0, result: [] };
  }
};

export const fetchKeyStatistics = async (
  symbol: string
): Promise<KeyStatistics> => {
  // Check frontend cache first
  const cached = getCached(statsCache, symbol);
  if (cached) {
    console.log(`[Cache HIT] Stats for ${symbol}`);
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${API_BASE_URL}/quote?symbol=${symbol}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Failed to fetch key statistics");
    }
    const data = await response.json();
    setCache(statsCache, symbol, data);
    return data;
  } catch (error) {
    console.error("Error fetching key statistics:", error);
    throw error;
  }
};

export const fetchCompanyNews = async (ticker: string, forceRefresh: boolean = false) => {
  try {
    const params = forceRefresh ? '?force_refresh=true' : '';
    const response = await fetch(`${API_BASE_URL}/news/${ticker}${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const fetchMarketNews = async (forceRefresh: boolean = false) => {
  try {
    const params = forceRefresh ? '?force_refresh=true' : '';
    const response = await fetch(`${API_BASE_URL}/news${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch market news');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching market news:', error);
    throw error;
  }
};

export const fetchStockHistory = async (symbol: string, timeframe: string) => {
  // Check frontend cache first
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = getCached(historyCache, cacheKey);
  if (cached) {
    console.log(`[Cache HIT] History for ${cacheKey}`);
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/history/${symbol}?timeframe=${timeframe}`);
    if (!response.ok) {
      throw new Error('Failed to fetch stock history');
    }
    const json = await response.json();
    setCache(historyCache, cacheKey, json.data);
    return json.data;
  } catch (error) {
    console.error('Error fetching stock history:', error);
    throw error;
  }
};

export const getWatchlist = async () => {
  const res = await fetch(`${API_BASE_URL}/watchlist`);
  return await res.json();
};

export const addToWatchlist = async (symbol: string, name: string) => {
  await fetch(`${API_BASE_URL}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, name })
  });
};

export const removeFromWatchlist = async (symbol: string) => {
  await fetch(`${API_BASE_URL}/watchlist/${symbol}`, {
    method: 'DELETE'
  });
};

// ===== Notifications =====

export interface Notification {
  id: string;
  type: 'DAILY_EOD' | 'MOMENTUM_2H' | 'MORNING_GAP';
  symbol: string;
  title: string;
  message: string;
  direction: 'up' | 'down';
  percentChange: number;
  timestamp: string;
}

export const fetchNotifications = async (): Promise<Notification[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const dismissNotification = async (notificationId: string): Promise<void> => {
  await fetch(`${API_BASE_URL}/notifications/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: notificationId })
  });
};

export const clearAllNotifications = async (): Promise<void> => {
  await fetch(`${API_BASE_URL}/notifications/clear-all`, {
    method: 'POST'
  });
};

