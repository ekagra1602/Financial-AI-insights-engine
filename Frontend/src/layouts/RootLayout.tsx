import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import { NotificationProvider, useNotification } from '../context/NotificationContext';
import { NotificationPanel } from '../components/NotificationPanel';

// Inner component — can safely use the context hook since it's inside NotificationProvider
const AppShell: React.FC = () => {
  const { isPanelOpen, togglePanel } = useNotification();

  // Lock body scroll when notification panel is open
  useEffect(() => {
    if (isPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPanelOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <Header />

      {/* Blurred backdrop — covers everything below the header when panel is open */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 top-[52px] md:top-[64px] z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={togglePanel}
          aria-label="Close notification panel"
        />
      )}

      {/* Notification slide-in panel (rendered on top of backdrop) */}
      {isPanelOpen && (
        <div className="relative z-50">
          <NotificationPanel />
        </div>
      )}

      {/* Main content area — pt-0 and enough pb for mobile bottom nav bar */}
      <main className="pb-[100px] mb-[env(safe-area-inset-bottom)] md:pb-0 md:mb-0">
        <Outlet />
      </main>
    </div>
  );
};

export const RootLayout: React.FC = () => {
  return (
    <NotificationProvider>
      <AppShell />
    </NotificationProvider>
  );
};