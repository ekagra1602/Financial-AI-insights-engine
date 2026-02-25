import React from 'react';
import { Clock, TrendingUp, TrendingDown, Target, Bell, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { StockReminder, ReminderStatus } from '../../types';

interface ReminderListProps {
  reminders: StockReminder[];
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
}

const getStatusBadge = (status: ReminderStatus) => {
  const baseClasses = "px-2 py-0.5 rounded-full text-xs font-medium";
  switch (status) {
    case 'active':
      return <span className={`${baseClasses} bg-primary/20 text-primary`}>Active</span>;
    case 'triggered':
      return <span className={`${baseClasses} bg-positive/20 text-positive`}>Triggered</span>;
    case 'expired':
      return <span className={`${baseClasses} bg-text-secondary/20 text-text-secondary`}>Expired</span>;
    case 'cancelled':
      return <span className={`${baseClasses} bg-negative/20 text-negative`}>Cancelled</span>;
    default:
      return null;
  }
};

const getConditionIcon = (type: string) => {
  switch (type) {
    case 'price_above':
      return <TrendingUp className="w-4 h-4 text-positive" />;
    case 'price_below':
      return <TrendingDown className="w-4 h-4 text-negative" />;
    case 'percent_change':
      return <Target className="w-4 h-4 text-primary" />;
    case 'time_based':
      return <Clock className="w-4 h-4 text-text-secondary" />;
    default:
      return <Bell className="w-4 h-4 text-text-secondary" />;
  }
};

const formatCondition = (reminder: StockReminder): string => {
  const { condition } = reminder;
  switch (condition.type) {
    case 'price_above':
      return `Price goes above $${condition.targetPrice?.toFixed(2)}`;
    case 'price_below':
      return `Price drops below $${condition.targetPrice?.toFixed(2)}`;
    case 'percent_change':
      return `${condition.percentChange! > 0 ? '+' : ''}${condition.percentChange?.toFixed(1)}% change`;
    case 'time_based':
      return `At ${new Date(condition.triggerTime!).toLocaleString()}`;
    case 'custom':
      return condition.customCondition || 'Custom condition';
    default:
      return 'Unknown condition';
  }
};

export const ReminderList: React.FC<ReminderListProps> = ({ reminders, onDelete, onCancel }) => {
  const activeReminders = reminders.filter(r => r.status === 'active');
  const pastReminders = reminders.filter(r => r.status !== 'active');

  if (reminders.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-text-secondary" />
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">No Reminders Yet</h3>
        <p className="text-text-secondary text-sm">
          Create your first stock reminder using natural language above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Reminders */}
      {activeReminders.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Active Reminders ({activeReminders.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {activeReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onDelete={onDelete}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Reminders */}
      {pastReminders.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-text-secondary flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Past Reminders ({pastReminders.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {pastReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onDelete={onDelete}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ReminderCardProps {
  reminder: StockReminder;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({ reminder, onDelete, onCancel }) => {
  return (
    <div className="px-6 py-4 hover:bg-background/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center flex-shrink-0">
            {getConditionIcon(reminder.condition.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-primary">{reminder.ticker}</span>
              {reminder.companyName && (
                <span className="text-sm text-text-secondary">{reminder.companyName}</span>
              )}
              {getStatusBadge(reminder.status)}
            </div>
            <p className="text-sm text-text-primary mb-2">{reminder.action}</p>
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                {getConditionIcon(reminder.condition.type)}
                {formatCondition(reminder)}
              </span>
              {reminder.currentPrice && (
                <span>Current: ${reminder.currentPrice.toFixed(2)}</span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-2 italic">
              "{reminder.originalText}"
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reminder.status === 'active' && (
            <button
              onClick={() => onCancel(reminder.id)}
              className="p-2 text-text-secondary hover:text-negative hover:bg-negative/10 rounded-lg transition-colors"
              title="Cancel reminder"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-2 text-text-secondary hover:text-negative hover:bg-negative/10 rounded-lg transition-colors"
            title="Delete reminder"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
        <span>Created: {new Date(reminder.createdAt).toLocaleDateString()}</span>
        {reminder.triggeredAt && (
          <span className="text-positive">
            Triggered: {new Date(reminder.triggeredAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default ReminderList;
