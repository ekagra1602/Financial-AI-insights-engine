import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import { useNotification } from '../context/NotificationContext';
import { NotificationPanel } from '../components/NotificationPanel';

export const RootLayout: React.FC = () => {
  const { isPanelOpen, closePanel } = useNotification();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header with navigation - High Z-index to stay above backdrop */}
      <div className="relative z-[70]">
        <Header />
      </div>

      {/* Main content area */}
      <main className="relative z-10">
        <Outlet />
      </main>

      {/* Backdrop Blur Overlay */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 z-[50] bg-black/20 backdrop-blur-sm transition-all duration-300"
          onClick={closePanel} // Click backdrop to close
          style={{ top: '64px' }} // Start below header
        />
      )}

      {/* Notification Panel - Fixed Position */}
      {isPanelOpen && <NotificationPanel />}
    </div>
  );
};