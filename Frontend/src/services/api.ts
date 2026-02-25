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

// ── Reminder persistence ──────────────────────────────────────────────────────

export interface SavedReminderResponse {
  id: string;
  original_text: string;
  ticker: string;
  company_name: string | null;
  action: string;
  status: 'active' | 'triggered' | 'expired' | 'cancelled';
  condition_type: 'price_above' | 'price_below' | 'percent_change' | 'time_based' | 'custom';
  target_price: number | null;
  percent_change: number | null;
  trigger_time: string | null;
  custom_condition: string | null;
  created_at: string;
  triggered_at: string | null;
  current_price: number | null;
  notes: string | null;
}

export interface SaveReminderPayload {
  original_text: string;
  ticker: string;
  company_name?: string | null;
  action: string;
  condition_type: string;
  target_price?: number | null;
  percent_change?: number | null;
  trigger_time?: string | null;
  custom_condition?: string | null;
  current_price?: number | null;
  notes?: string | null;
}

export const saveReminder = async (payload: SaveReminderPayload): Promise<SavedReminderResponse> => {
  const response = await fetch(`${API_BASE_URL}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to save reminder');
  return response.json();
};

export const fetchReminders = async (): Promise<SavedReminderResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/reminders`);
  if (!response.ok) throw new Error('Failed to fetch reminders');
  return response.json();
};

export const updateReminderStatus = async (
  id: string,
  status: 'active' | 'triggered' | 'expired' | 'cancelled'
): Promise<SavedReminderResponse> => {
  const response = await fetch(`${API_BASE_URL}/reminders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update reminder status');
  return response.json();
};

export const deleteReminder = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reminders/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete reminder');
};

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertResponse {
  id: string;
  reminder_id: string;
  ticker: string;
  message: string;
  triggered_at: string;
  is_read: boolean;
}

export const fetchAlerts = async (): Promise<AlertResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/alerts`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
};

export const markAlertRead = async (id: string): Promise<AlertResponse> => {
  const response = await fetch(`${API_BASE_URL}/alerts/${id}/read`, { method: 'PATCH' });
  if (!response.ok) throw new Error('Failed to mark alert as read');
  return response.json();
};

export const dismissAlert = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/alerts/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to dismiss alert');
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

// ===== Notifications =====

export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  source: string;
}

export interface Notification {
  id: string;
  type: 'DAILY_EOD' | 'MOMENTUM_2H' | 'MORNING_GAP' | 'NEWS_BRIEFING';
  symbol: string;
  title: string;
  message: string;
  direction: 'up' | 'down' | 'neutral';
  percentChange: number;
  timestamp: string;
  articles?: NewsArticle[];  // Only for NEWS_BRIEFING
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

// ===== News Briefing (Dedicated Endpoints) =====

export const toggleNewsBriefing = async (symbol: string, enabled: boolean): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE_URL}/news-briefing/toggle/${symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) {
      console.error(`Failed to toggle news briefing for ${symbol}: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error(`Error toggling news briefing for ${symbol}:`, err);
  }
};

export const triggerNewsBriefingGeneration = async (): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE_URL}/news-briefing/generate`, {
      method: 'POST',
    });
    if (!res.ok) {
      console.error(`Failed to trigger news briefing generation: ${res.status}`);
    }
  } catch (err) {
    console.error('Error triggering news briefing generation:', err);
  }
};

// ===== Account Settings =====

const ACCOUNT_BASE = "http://localhost:8000/api/v1/account";

export interface AccountSettings {
  email: string;
  email_confirmed: boolean;
  email_notifications_enabled: boolean;
}

export const getAccountSettings = async (): Promise<AccountSettings> => {
  const res = await fetch(`${ACCOUNT_BASE}/settings`);
  return res.json();
};

export const saveEmail = async (email: string): Promise<{ message: string }> => {
  const res = await fetch(`${ACCOUNT_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
};

export const confirmEmail = async (code: string): Promise<{ confirmed: boolean; message: string }> => {
  const res = await fetch(`${ACCOUNT_BASE}/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
};

export const toggleEmailNotifications = async (enabled: boolean): Promise<void> => {
  await fetch(`${ACCOUNT_BASE}/email-notifications`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
};
