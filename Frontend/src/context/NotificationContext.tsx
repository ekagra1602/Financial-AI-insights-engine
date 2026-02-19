import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { fetchNotifications, dismissNotification as apiDismiss, clearAllNotifications as apiClearAll, triggerNewsBriefingGeneration, Notification } from '../services/api';

interface NotificationContextType {
    notifications: Notification[];
    isPanelOpen: boolean;
    togglePanel: () => void;
    openPanel: () => void;
    closePanel: () => void;
    dismissNotification: (id: string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const lastBriefingDate = useRef<string>('');

    // Load and stamp notifications
    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await fetchNotifications();
            setNotifications(data);
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    // Poll every 30s
    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30_000);
        return () => clearInterval(interval);
    }, []);

    // 10 AM ET daily timer for news briefing generation
    useEffect(() => {
        const check10AM = () => {
            // Get current ET time
            const now = new Date();
            const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
            const etDate = new Date(etString);
            const hour = etDate.getHours();
            const minute = etDate.getMinutes();
            const todayStr = etDate.toISOString().slice(0, 10);

            // Trigger at 10:00 AM ET, but only once per day
            if (hour === 10 && minute === 0 && lastBriefingDate.current !== todayStr) {
                lastBriefingDate.current = todayStr;
                console.log('[News Briefing] 10 AM ET — triggering generation');
                triggerNewsBriefingGeneration();
                // Reload notifications after a delay to pick up the new briefings
                setTimeout(loadNotifications, 60_000);
            }
        };

        // Check every 60 seconds
        const interval = setInterval(check10AM, 60_000);
        return () => clearInterval(interval);
    }, []);

    const togglePanel = () => setIsPanelOpen(prev => !prev);
    const openPanel = () => setIsPanelOpen(true);
    const closePanel = () => setIsPanelOpen(false);

    const dismissNotification = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.id !== id));
        await apiDismiss(id);
    };

    const clearAllNotifications = async () => {
        // Optimistic update
        setNotifications([]);
        await apiClearAll();
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            isPanelOpen,
            togglePanel,
            openPanel,
            closePanel,
            dismissNotification,
            clearAllNotifications,
            loading
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
