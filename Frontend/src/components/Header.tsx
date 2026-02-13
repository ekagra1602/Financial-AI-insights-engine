import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, MessageSquare, TrendingUp, Home, Newspaper, Search } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const Header: React.FC = () => {
  const location = useLocation();
  const { notifications, togglePanel, isPanelOpen } = useNotification();

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <img src="/Qualcomm.png" alt="Qualcomm Logo" className="h-8 w-auto" />
              <div className="text-text-primary font-semibold text-lg">Financial Insights Engine</div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <Link to="/" className={`flex items-center gap-2 ${location.pathname === '/' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
              <Home className="w-5 h-5" /><span>Dashboard</span>
            </Link>
            <Link to="/web-search" className={`flex items-center gap-2 ${location.pathname === '/web-search' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
              <Search className="w-5 h-5" /><span>Search</span>
            </Link>
            <Link to="/news" className={`flex items-center gap-2 ${location.pathname.includes('/news') ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
              <Newspaper className="w-5 h-5" /><span>News</span>
            </Link>
            <Link to="/sentiment-reports" className={`flex items-center gap-2 ${location.pathname.includes('/sentiment-reports') ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
              <TrendingUp className="w-5 h-5" /><span>Insights</span>
            </Link>
            <Link to="/chatbot" className={`flex items-center gap-2 ${location.pathname === '/chatbot' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
              <MessageSquare className="w-5 h-5" /><span>Chatbot</span>
            </Link>

            {/* ===== Notification Bell ===== */}
            <button
              onClick={togglePanel}
              className={`relative text-text-primary hover:text-primary transition-colors ${isPanelOpen ? 'text-primary' : ''}`}
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-negative rounded-full text-xs flex items-center justify-center text-white font-medium animate-pulse">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            <button className="text-text-primary hover:text-primary transition-colors">Account</button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
