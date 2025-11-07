import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navigation } from '../components/Navigation';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar that stays fixed at the top */}
      <Navigation />
      
      {/* Main content area */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
};
