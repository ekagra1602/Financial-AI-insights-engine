import React, { useState, useEffect } from 'react';
import { Bell, Clock, Zap, Info } from 'lucide-react';
import { ReminderInput, ReminderList, AlertsPanel } from '../components/reminders';
import { StockReminder, ReminderAlert, ReminderCondition } from '../types';
import {
  parseReminderText as apiParseReminder,
  ParsedReminderResponse,
  saveReminder,
  fetchReminders,
  updateReminderStatus,
  deleteReminder as apiDeleteReminder,
  SavedReminderResponse,
  SaveReminderPayload,
  fetchAlerts,
  markAlertRead,
  dismissAlert as apiDismissAlert,
  AlertResponse,
} from '../services/api';

// ── Company name lookup (fallback when backend doesn't return one) ────────────
const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  ABNB: 'Airbnb, Inc.',
  NVDA: 'NVIDIA Corporation',
  TSLA: 'Tesla, Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com, Inc.',
  META: 'Meta Platforms, Inc.',
  QCOM: 'Qualcomm Incorporated',
  AMD: 'Advanced Micro Devices, Inc.',
  INTC: 'Intel Corporation',
};
const COMPANY_TO_TICKER: Record<string, string> = {
  apple: 'AAPL',
  airbnb: 'ABNB',
  microsoft: 'MSFT',
  nvidia: 'NVDA',
  tesla: 'TSLA',
  amazon: 'AMZN',
  alphabet: 'GOOGL',
  google: 'GOOGL',
  meta: 'META',
  qualcomm: 'QCOM',
  amd: 'AMD',
  intel: 'INTC',
};
const TICKER_STOPWORDS = new Set([
  'a', 'an', 'and', 'at', 'below', 'buy', 'current', 'drop', 'drops', 'fall', 'falls',
  'for', 'from', 'gain', 'gains', 'go', 'goes', 'if', 'it', 'me', 'my', 'of',
  'on', 'or', 'price', 'review', 'sell', 'so', 'the', 'to', 'under', 'up', 'when',
]);

function extractTicker(text: string): string | null {
  const lowered = text.toLowerCase();

  for (const [companyName, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    const regex = new RegExp(`\\b${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowered)) {
      return ticker;
    }
  }

  const candidates = text.match(/\b([A-Za-z]{1,5})\b/g) ?? [];
  for (const candidate of candidates) {
    if (TICKER_STOPWORDS.has(candidate.toLowerCase())) {
      continue;
    }
    return candidate.toUpperCase();
  }

  return null;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  while (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

function parseRelativeTime(text: string): string | null {
  const now = new Date();
  const relativeMatch = text.match(/\b(?:in\s+)?(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b/i);

  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const triggerDate = new Date(now);

    if (unit.startsWith('minute')) triggerDate.setMinutes(triggerDate.getMinutes() + amount);
    else if (unit.startsWith('hour')) triggerDate.setHours(triggerDate.getHours() + amount);
    else if (unit.startsWith('day')) triggerDate.setDate(triggerDate.getDate() + amount);
    else if (unit.startsWith('week')) triggerDate.setDate(triggerDate.getDate() + amount * 7);
    else if (unit.startsWith('month')) return addMonths(now, amount).toISOString();

    return triggerDate.toISOString();
  }

  if (/\btomorrow\b/i.test(text)) {
    const triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + 1);
    return triggerDate.toISOString();
  }

  if (/\bnext week\b/i.test(text)) {
    const triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + 7);
    return triggerDate.toISOString();
  }

  if (/\bnext month\b/i.test(text)) {
    return addMonths(now, 1).toISOString();
  }

  return null;
}

// ── Client-side regex parser (fallback when backend is unreachable) ──────────
function localParse(text: string): ParsedReminderResponse {
  const aboveMatch = text.match(/(?:above|over|reaches?|hits?)\s*\$?(\d+(?:\.\d{2})?)/i);
  const belowMatch = text.match(/(?:below|under|drops?\s*(?:to)?)\s*\$?(\d+(?:\.\d{2})?)/i);
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/i);
  const triggerTime = parseRelativeTime(text);

  const ticker = extractTicker(text);
  let condition_type: ParsedReminderResponse['condition_type'] = 'custom';
  let target_price: number | null = null;
  let percent_change: number | null = null;
  let action = 'Review and take action';

  if (aboveMatch) {
    condition_type = 'price_above';
    target_price = parseFloat(aboveMatch[1]);
    if (text.toLowerCase().includes('sell')) action = 'Consider selling';
  } else if (belowMatch) {
    condition_type = 'price_below';
    target_price = parseFloat(belowMatch[1]);
    if (text.toLowerCase().includes('buy')) action = 'Consider buying';
  } else if (pctMatch) {
    condition_type = 'percent_change';
    const val = parseFloat(pctMatch[1]);
    const neg = /drop|fall|down|lose/i.test(text);
    percent_change = neg ? -val : val;
  } else if (triggerTime) {
    condition_type = 'time_based';
  }

  return {
    ticker,
    company_name: ticker ? (COMPANY_NAMES[ticker] ?? null) : null,
    action,
    condition_type,
    target_price,
    percent_change,
    trigger_time: triggerTime,
    current_price: null,
    notes: text,
    source: 'client_regex',
  };
}

// ── Mapper: flat DB row → nested StockReminder ────────────────────────────────
function savedReminderToStockReminder(r: SavedReminderResponse): StockReminder {
  let condition: ReminderCondition;
  switch (r.condition_type) {
    case 'price_above':
      condition = { type: 'price_above', targetPrice: r.target_price ?? undefined };
      break;
    case 'price_below':
      condition = { type: 'price_below', targetPrice: r.target_price ?? undefined };
      break;
    case 'percent_change':
      condition = {
        type: 'percent_change',
        percentChange: r.percent_change ?? undefined,
        targetPrice: r.target_price ?? undefined,
      };
      break;
    case 'time_based':
      condition = { type: 'time_based', triggerTime: r.trigger_time ?? undefined };
      break;
    default:
      condition = { type: 'custom', customCondition: r.custom_condition ?? undefined };
  }
  return {
    id:           r.id,
    originalText: r.original_text,
    ticker:       r.ticker,
    companyName:  r.company_name ?? undefined,
    action:       r.action,
    condition,
    status:       r.status,
    createdAt:    r.created_at,
    triggeredAt:  r.triggered_at ?? undefined,
    currentPrice: r.current_price ?? undefined,
    notes:        r.notes ?? undefined,
  };
}

// ── Alert mapper ──────────────────────────────────────────────────────────────
function alertResponseToReminderAlert(
  a: AlertResponse,
  reminders: StockReminder[]
): ReminderAlert {
  const found = reminders.find(r => r.id === a.reminder_id);
  const originalReminder: StockReminder = found ?? {
    id: a.reminder_id,
    originalText: '',
    ticker: a.ticker,
    action: '',
    condition: { type: 'custom' },
    status: 'triggered',
    createdAt: a.triggered_at,
  };
  return {
    id:               a.id,
    reminderId:       a.reminder_id,
    ticker:           a.ticker,
    message:          a.message,
    triggeredAt:      a.triggered_at,
    isRead:           a.is_read,
    originalReminder,
  };
}

// ── Page Component ────────────────────────────────────────────────────────────
export const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<StockReminder[]>([]);
  const [alerts, setAlerts] = useState<ReminderAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  const refreshData = async (withLoading = false) => {
    if (withLoading) {
      setIsLoading(true);
    }

    try {
      const [reminderRows, alertRows] = await Promise.all([
        fetchReminders(),
        fetchAlerts(),
      ]);
      const mappedReminders = reminderRows.map(savedReminderToStockReminder);
      setReminders(mappedReminders);
      setAlerts(alertRows.map(a => alertResponseToReminderAlert(a, mappedReminders)));
    } catch (err) {
      console.error('Failed to load data:', err);
      if (withLoading) {
        setShowToast('Could not load reminders from server.');
      }
    } finally {
      if (withLoading) {
        setIsLoading(false);
      }
    }
  };

  // Load reminders + alerts on mount, then poll alerts every 60s
  useEffect(() => {
    refreshData(true);

    // Poll for new alerts every 15 seconds
    const pollId = setInterval(async () => {
      await refreshData();
    }, 15_000);

    return () => clearInterval(pollId);
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleCreateReminder = async (text: string) => {
    setIsProcessing(true);

    let parsed: ParsedReminderResponse;
    try {
      parsed = await apiParseReminder(text);
    } catch (err) {
      if (!(err instanceof TypeError)) {
        console.error('AI reminder parsing failed:', err);
        setShowToast('AI could not parse that reminder. Try rephrasing it with a ticker or company name.');
        setIsProcessing(false);
        return;
      }
      console.warn('Backend unavailable, using client-side parser.');
      parsed = localParse(text);
    }

    if (parsed.ticker || parsed.condition_type === 'time_based') {
      const payload: SaveReminderPayload = {
        original_text:    text,
        ticker:           parsed.ticker ?? '',
        company_name:     parsed.company_name,
        action:           parsed.action || 'Review and take action',
        condition_type:   parsed.condition_type,
        target_price:     parsed.target_price,
        percent_change:   parsed.percent_change,
        trigger_time:     parsed.trigger_time,
        custom_condition: parsed.condition_type === 'custom' ? (parsed.notes ?? undefined) : undefined,
        current_price:    parsed.current_price,
        notes:            parsed.notes,
      };

      try {
        const saved = await saveReminder(payload);
        setReminders(prev => [savedReminderToStockReminder(saved), ...prev]);

        const priceStr = saved.current_price ? ` (live: $${saved.current_price.toFixed(2)})` : '';
        const reminderLabel = saved.ticker || saved.company_name || 'reminder';
        const sourceLabel =
          parsed.source === 'llm' ? 'AI' :
          parsed.source === 'regex_fallback' ? 'server fallback' : 'local';
        setShowToast(`Reminder created for ${reminderLabel}${priceStr} — parsed via ${sourceLabel}`);
        window.setTimeout(() => {
          refreshData();
        }, 1500);
      } catch (err) {
        console.error('Failed to save reminder:', err);
        setShowToast('Parsed reminder but could not save it. Try again.');
      }
    } else {
      setShowToast('Could not extract a stock ticker. Try: "Alert me when AAPL drops below $170"');
    }

    setIsProcessing(false);
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await apiDeleteReminder(id);
    } catch (err) {
      console.error('Delete failed:', err);
      setShowToast('Could not delete reminder. Try again.');
      return;
    }
    setReminders(prev => prev.filter(r => r.id !== id));
    setAlerts(prev => prev.filter(a => a.reminderId !== id));
    setShowToast('Reminder deleted');
  };

  const handleCancelReminder = async (id: string) => {
    try {
      const updated = await updateReminderStatus(id, 'cancelled');
      setReminders(prev =>
        prev.map(r => r.id === id ? savedReminderToStockReminder(updated) : r)
      );
      setShowToast('Reminder cancelled');
    } catch (err) {
      console.error('Cancel failed:', err);
      setShowToast('Could not cancel reminder. Try again.');
    }
  };

  const handleMarkAlertAsRead = async (id: string) => {
    try {
      await markAlertRead(id);
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const handleDismissAlert = async (id: string) => {
    try {
      await apiDismissAlert(id);
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleViewReminder = (reminderId: string) => {
    console.log('View reminder:', reminderId);
  };

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex items-center justify-center min-h-64">
        <p className="text-text-secondary">Loading reminders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-6 z-50 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg animate-pulse">
          <p className="text-sm text-text-primary">{showToast}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Stock Reminders</h1>
            <p className="text-text-secondary">
              Create intelligent alerts using natural language
            </p>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-secondary">AI-Powered Parsing</span>
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-secondary">Persistent Storage</span>
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-secondary">Instant Notifications</span>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-text-primary">
            <strong>How it works:</strong> Type your reminder in plain English like "Alert me when AAPL drops below $170"
            and our AI will extract the stock, condition, and action to create a smart reminder.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <ReminderInput onSubmit={handleCreateReminder} isProcessing={isProcessing} />
          <ReminderList
            reminders={reminders}
            onDelete={handleDeleteReminder}
            onCancel={handleCancelReminder}
          />
        </div>

        {/* Sidebar - Alerts */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <AlertsPanel
              alerts={alerts}
              onMarkAsRead={handleMarkAlertAsRead}
              onDismiss={handleDismissAlert}
              onViewReminder={handleViewReminder}
            />

            {/* Stats Card */}
            <div className="mt-6 bg-surface rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Active Reminders</span>
                  <span className="font-semibold text-primary">
                    {reminders.filter(r => r.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Triggered</span>
                  <span className="font-semibold text-positive">
                    {reminders.filter(r => r.status === 'triggered').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Unread Alerts</span>
                  <span className="font-semibold text-negative">
                    {alerts.filter(a => !a.isRead).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemindersPage;
