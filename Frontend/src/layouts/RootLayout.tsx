import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <Header />
      
      {/* Main content area */}
      <main className="pt-6">
        <Outlet />
      </main>
    </div>
  );
};