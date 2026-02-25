import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import { NotificationProvider, useNotification } from '../context/NotificationContext';
import { NotificationPanel } from '../components/NotificationPanel';

// Inner component — can safely use the context hook since it's inside NotificationProvider
const AppShell: React.FC = () => {
  const { isPanelOpen } = useNotification();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <Header />

      {/* Notification slide-in panel (rendered when open) */}
      {isPanelOpen && <NotificationPanel />}

      {/* Main content area */}
      <main>
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