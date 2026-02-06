import React, { useState, useEffect } from 'react';
import { Bell, Clock, Zap, Info } from 'lucide-react';
import { ReminderInput, ReminderList, AlertsPanel } from '../components/reminders';
import { StockReminder, ReminderAlert, ReminderCondition } from '../types';
import { parseReminderText as apiParseReminder, ParsedReminderResponse } from '../services/api';

// ── Company name lookup ──────────────────────────────────────────────
const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
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

// ── Client-side regex parser (fallback when backend is unreachable) ──
function localParse(text: string): ParsedReminderResponse {
  const tickerMatch = text.match(/\b([A-Z]{1,5})\b/);
  const aboveMatch = text.match(/(?:above|over|reaches?|hits?)\s*\$?(\d+(?:\.\d{2})?)/i);
  const belowMatch = text.match(/(?:below|under|drops?\s*(?:to)?)\s*\$?(\d+(?:\.\d{2})?)/i);
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/i);

  const ticker = tickerMatch ? tickerMatch[1] : null;
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
  }

  return {
    ticker,
    company_name: ticker ? (COMPANY_NAMES[ticker] ?? null) : null,
    action,
    condition_type,
    target_price,
    percent_change,
    trigger_time: null,
    current_price: null,
    notes: text,
    source: 'client_regex',
  };
}

// ── Demo data ────────────────────────────────────────────────────────
const DEMO_REMINDERS: StockReminder[] = [
  {
    id: '1',
    originalText: 'Remind me to buy AAPL if the price drops below $170',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    action: 'Buy shares',
    condition: { type: 'price_below', targetPrice: 170.00 },
    status: 'active',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    currentPrice: 178.50,
  },
  {
    id: '2',
    originalText: 'Alert me when NVDA goes above $500',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    action: 'Consider selling partial position',
    condition: { type: 'price_above', targetPrice: 500.00 },
    status: 'triggered',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    triggeredAt: new Date(Date.now() - 3600000).toISOString(),
    currentPrice: 512.30,
  },
  {
    id: '3',
    originalText: 'Notify me if TSLA drops 5% from current price',
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
    action: 'Review position and consider adding',
    condition: { type: 'percent_change', percentChange: -5.0 },
    status: 'active',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    currentPrice: 248.75,
  },
];

const DEMO_ALERTS: ReminderAlert[] = [
  {
    id: 'a1',
    reminderId: '2',
    ticker: 'NVDA',
    message: 'NVDA has risen above $500! Current price: $512.30. You wanted to consider selling partial position.',
    triggeredAt: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
    originalReminder: DEMO_REMINDERS[1],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
function buildConditionFromResponse(parsed: ParsedReminderResponse): ReminderCondition {
  switch (parsed.condition_type) {
    case 'price_above':
      return { type: 'price_above', targetPrice: parsed.target_price ?? undefined };
    case 'price_below':
      return { type: 'price_below', targetPrice: parsed.target_price ?? undefined };
    case 'percent_change':
      return { type: 'percent_change', percentChange: parsed.percent_change ?? undefined };
    case 'time_based':
      return { type: 'time_based', triggerTime: parsed.trigger_time ?? undefined };
    default:
      return { type: 'custom', customCondition: parsed.notes ?? undefined };
  }
}

// ── Page Component ───────────────────────────────────────────────────
export const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<StockReminder[]>(DEMO_REMINDERS);
  const [alerts, setAlerts] = useState<ReminderAlert[]>(DEMO_ALERTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

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
      // Try the backend first (AI100 LLM + live Finnhub price)
      parsed = await apiParseReminder(text);
    } catch {
      // Backend unreachable — fall back to client-side regex parsing
      console.warn('Backend unavailable, using client-side parser.');
      parsed = localParse(text);
    }

    if (parsed.ticker) {
      const newReminder: StockReminder = {
        id: Date.now().toString(),
        originalText: text,
        ticker: parsed.ticker,
        companyName: parsed.company_name || COMPANY_NAMES[parsed.ticker] || undefined,
        action: parsed.action || 'Review and take action',
        condition: buildConditionFromResponse(parsed),
        status: 'active',
        createdAt: new Date().toISOString(),
        currentPrice: parsed.current_price ?? undefined,
        notes: parsed.notes ?? undefined,
      };

      setReminders((prev) => [newReminder, ...prev]);

      const priceStr = parsed.current_price ? ` (live: $${parsed.current_price.toFixed(2)})` : '';
      const sourceLabel =
        parsed.source === 'llm' ? 'AI' :
        parsed.source === 'regex_fallback' ? 'server fallback' : 'local';
      setShowToast(`Reminder created for ${parsed.ticker}${priceStr} — parsed via ${sourceLabel}`);
    } else {
      setShowToast('Could not extract a stock ticker. Try: "Alert me when AAPL drops below $170"');
    }

    setIsProcessing(false);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setAlerts((prev) => prev.filter((a) => a.reminderId !== id));
    setShowToast('Reminder deleted');
  };

  const handleCancelReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r))
    );
    setShowToast('Reminder cancelled');
  };

  const handleMarkAlertAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
  };

  const handleDismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleViewReminder = (reminderId: string) => {
    console.log('View reminder:', reminderId);
  };

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
            <span className="text-sm text-text-secondary">Real-time Price Monitoring</span>
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
                    {reminders.filter((r) => r.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Triggered Today</span>
                  <span className="font-semibold text-positive">
                    {reminders.filter((r) => r.status === 'triggered').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Unread Alerts</span>
                  <span className="font-semibold text-negative">
                    {alerts.filter((a) => !a.isRead).length}
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
