import React from 'react';
import { Search, Bell, MessageSquare, TrendingUp } from 'lucide-react';
import { Navigation } from './Navigation';

const Header: React.FC = () => {
  return (
    <>
      <Navigation />
      <header className="bg-surface border-b border-border sticky top-16 z-40">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-primary">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M16 2L2 9v14c0 8 14 7 14 7s14 1 14-7V9L16 2z" />
                  </svg>
                </div>
                <div className="text-text-primary font-semibold text-lg">
                  Qualcomm Financial Engine
                </div>
              </div>

              {/* Search */}
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-6">
              <button className="relative text-text-primary hover:text-primary transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-negative rounded-full text-xs flex items-center justify-center text-white">
                  1
                </span>
              </button>
              <button className="text-text-primary hover:text-primary transition-colors">
                Account
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

