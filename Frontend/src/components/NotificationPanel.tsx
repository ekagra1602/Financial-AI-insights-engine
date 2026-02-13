import React, { useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { X, ArrowUpRight, ArrowDownRight, Zap, Sunrise, BarChart3, Bell } from 'lucide-react';

const NOTIFICATION_STYLES: Record<string, {
    label: string;
    bgColor: string;
    textColor: string;
    iconBg: string;
    badgeBg: string;
    icon: React.ReactNode;
}> = {
    DAILY_EOD: {
        label: 'End of Day',
        bgColor: 'border-l-purple-500',
        textColor: 'text-purple-400',
        iconBg: 'bg-purple-500/15',
        badgeBg: 'bg-purple-500/20 text-purple-300',
        icon: <BarChart3 className="w-5 h-5" />,
    },
    MOMENTUM_2H: {
        label: '2hr Momentum',
        bgColor: 'border-l-amber-500',
        textColor: 'text-amber-400',
        iconBg: 'bg-amber-500/15',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        icon: <Zap className="w-5 h-5" />,
    },
    MORNING_GAP: {
        label: 'Morning Gap',
        bgColor: 'border-l-blue-500',
        textColor: 'text-blue-400',
        iconBg: 'bg-blue-500/15',
        badgeBg: 'bg-blue-500/20 text-blue-300',
        icon: <Sunrise className="w-5 h-5" />,
    },
};

const getStyle = (type: string) => NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.MOMENTUM_2H;

export const NotificationPanel: React.FC = () => {
    const { notifications, closePanel, dismissNotification, clearAllNotifications } = useNotification();

    // Disable background scrolling when panel is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed right-0 top-[64px] h-[calc(100vh-64px)] w-full md:w-1/3 min-w-[320px] bg-surface border-l border-border shadow-2xl z-[60] flex flex-col transition-transform duration-300 ease-in-out">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-xl font-bold text-text-primary">Notifications</h2>
                <div className="flex items-center gap-3">
                    {notifications.length > 0 && (
                        <button
                            onClick={() => clearAllNotifications()}
                            className="text-xs text-text-secondary hover:text-primary transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                    <button
                        onClick={closePanel}
                        className="p-1 hover:bg-surface-light rounded-full text-text-secondary transition-colors"
                        title="Close panel"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Legend */}
            {notifications.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-3 bg-surface-light/30 border-b border-border/50">
                    {Object.entries(NOTIFICATION_STYLES).map(([key, style]) => (
                        <span key={key} className={`text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 ${style.badgeBg}`}>
                            {style.icon} {style.label}
                        </span>
                    ))}
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                        <Bell className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-base font-medium">No notifications</p>
                        <p className="text-sm mt-2 opacity-60 text-center max-w-[200px]">
                            Big market moves will appear here during trading hours
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {notifications.map((n) => {
                            const style = getStyle(n.type);
                            return (
                                <div
                                    key={n.id}
                                    className={`relative p-4 rounded-lg bg-surface-light/30 border border-border/50 border-l-[4px] ${style.bgColor} hover:bg-surface-light transition-all group`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${style.iconBg} ${style.textColor}`}>
                                            {style.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badgeBg}`}>
                                                    {style.label}
                                                </span>
                                                <span className="text-[10px] text-text-secondary ml-auto">
                                                    {n.timestamp}
                                                </span>
                                            </div>

                                            <div className="flex items-baseline gap-2 mb-1">
                                                <h3 className="font-bold text-lg text-text-primary">{n.symbol}</h3>
                                                <span className={`text-sm font-bold flex items-center ${n.direction === 'up' ? 'text-positive' : 'text-negative'
                                                    }`}>
                                                    {n.direction === 'up' ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                                                    {Math.abs(n.percentChange).toFixed(2)}%
                                                </span>
                                            </div>

                                            <p className="text-sm text-text-secondary leading-relaxed">
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Dismiss Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            dismissNotification(n.id);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-surface-light text-text-secondary hover:text-negative rounded-lg transition-all"
                                        title="Dismiss"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
