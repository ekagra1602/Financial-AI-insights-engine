import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchNotifications, dismissNotification as apiDismiss, clearAllNotifications as apiClearAll, Notification } from '../services/api';

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

    // Load and stamp notifications
    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await fetchNotifications();
            // Backend now provides nice descriptive messages, so raw timestamp display might be secondary
            // but we still want to sort/display them nicely.
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
