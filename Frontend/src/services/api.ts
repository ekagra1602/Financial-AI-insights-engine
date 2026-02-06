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

export const fetchCompanyNews = async (ticker: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/news/${ticker}`);
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const fetchMarketNews = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/news`);
    if (!response.ok) {
      throw new Error('Failed to fetch market news');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching market news:', error);
    throw error;
  }
};

// Reminder parsing via AI100 LLM
export interface ParsedReminderResponse {
  ticker: string | null;
  company_name: string | null;
  action: string | null;
  condition_type: 'price_above' | 'price_below' | 'percent_change' | 'time_based' | 'custom';
  target_price: number | null;
  percent_change: number | null;
  trigger_time: string | null;
  current_price: number | null;
  notes: string | null;
  source: string;
}

export const parseReminderText = async (text: string): Promise<ParsedReminderResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/reminders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error('Failed to parse reminder');
    }
    return await response.json();
  } catch (error) {
    console.error('Error parsing reminder:', error);
    throw error;
  }
};
