import { KeyStatistics, StockSymbol } from "../types";

const API_BASE_URL = "http://localhost:8000/api/v1";

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

export const fetchCompanies = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/companies`);
        if (!response.status.toString().startsWith('2')) return [];
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const fetchKeyStatistics = async (
  symbol: string
): Promise<KeyStatistics> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/quote?symbol=${symbol}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Failed to fetch key statistics");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching key statistics:", error);
    throw error;
  }
};

export const fetchCompanyNews = async (ticker: string, forceRefresh = false) => {
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

export const fetchMarketNews = async (forceRefresh = false) => {
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

export const fetchSimilarNews = async (urlHash: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/news/similar/${urlHash}`);
    if (!response.status.toString().startsWith('2')) {
       // 404 or others -> return empty
       return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching similar news:', error);
    return [];
  }
};

export const fetchStockHistory = async (symbol: string, timeframe: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${symbol}?timeframe=${timeframe}`);
    if (!response.ok) {
      throw new Error('Failed to fetch stock history');
    }
    const json = await response.json();
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
