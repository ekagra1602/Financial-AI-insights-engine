import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, MessageSquare, TrendingUp, Home, Newspaper } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();
  
  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-3">
                <div className="text-2xl font-bold text-primary">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M16 2L2 9v14c0 8 14 7 14 7s14 1 14-7V9L16 2z" />
                  </svg>
                </div>
                <div className="text-text-primary font-semibold text-lg">
                  Qualcomm Financial Engine
                </div>
              </Link>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className={`flex items-center gap-2 ${location.pathname === '/' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}
            >
              <Home className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/web-search"
              className={`flex items-center gap-2 ${location.pathname === '/web-search' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </Link>

            <Link
              to="/news"
              className={`flex items-center gap-2 ${location.pathname.includes('/news') ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}
            >
              <Newspaper className="w-5 h-5" />
              <span>News</span>
            </Link>

            <Link
              to="#"
              className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              <span>Insights</span>
            </Link>

            <Link
              to="#"
              className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chatbot</span>
            </Link>
            
            <button className="relative text-text-primary hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-negative rounded-full text-xs flex items-center justify-center text-white">
                1
              </span>
            </button>
            
            <button className="text-text-primary hover:text-primary transition-colors">
              Account
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;