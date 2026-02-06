import React from 'react';
import { Bell, BellRing, Check, X, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { ReminderAlert } from '../../types';

interface AlertsPanelProps {
  alerts: ReminderAlert[];
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onViewReminder: (reminderId: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onMarkAsRead,
  onDismiss,
  onViewReminder,
}) => {
  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const readAlerts = alerts.filter((a) => a.isRead);

  if (alerts.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Alerts</h3>
            <p className="text-sm text-text-secondary">No alerts yet</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">
            When your reminder conditions are met, alerts will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center relative">
            <BellRing className="w-5 h-5 text-primary" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-negative rounded-full text-xs flex items-center justify-center text-white font-medium">
                {unreadAlerts.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Triggered Alerts</h3>
            <p className="text-sm text-text-secondary">
              {unreadAlerts.length} unread, {readAlerts.length} read
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {/* Unread Alerts */}
        {unreadAlerts.length > 0 && (
          <div className="divide-y divide-border">
            {unreadAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onMarkAsRead={onMarkAsRead}
                onDismiss={onDismiss}
                onViewReminder={onViewReminder}
              />
            ))}
          </div>
        )}

        {/* Read Alerts */}
        {readAlerts.length > 0 && (
          <>
            {unreadAlerts.length > 0 && (
              <div className="px-6 py-2 bg-background text-xs text-text-secondary uppercase tracking-wide">
                Earlier
              </div>
            )}
            <div className="divide-y divide-border opacity-60">
              {readAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkAsRead={onMarkAsRead}
                  onDismiss={onDismiss}
                  onViewReminder={onViewReminder}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface AlertCardProps {
  alert: ReminderAlert;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onViewReminder: (reminderId: string) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onMarkAsRead, onDismiss, onViewReminder }) => {
  const isPositive = alert.originalReminder.condition.type === 'price_above';
  
  return (
    <div className={`px-6 py-4 hover:bg-background/50 transition-colors ${!alert.isRead ? 'bg-primary/5' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPositive ? 'bg-positive/20' : 'bg-negative/20'
        }`}>
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-positive" />
          ) : (
            <TrendingDown className="w-5 h-5 text-negative" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-primary">{alert.ticker}</span>
            {!alert.isRead && (
              <span className="w-2 h-2 bg-primary rounded-full" />
            )}
          </div>
          <p className="text-sm text-text-primary mb-2">{alert.message}</p>
          <p className="text-xs text-text-secondary">
            {new Date(alert.triggeredAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!alert.isRead && (
            <button
              onClick={() => onMarkAsRead(alert.id)}
              className="p-2 text-text-secondary hover:text-positive hover:bg-positive/10 rounded-lg transition-colors"
              title="Mark as read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onViewReminder(alert.reminderId)}
            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="View reminder"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDismiss(alert.id)}
            className="p-2 text-text-secondary hover:text-negative hover:bg-negative/10 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertsPanel;
