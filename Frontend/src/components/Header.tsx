import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, MessageSquare, TrendingUp, Home, Newspaper, BellRing, User } from 'lucide-react';
import { fetchAlerts, type AlertResponse } from '../services/api';
import AccountModal from './AccountModal';

interface HeaderProps {
  onSearch?: (ticker: string) => void;
}

const Header: React.FC<HeaderProps> = () => {
  const location = useLocation();
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAlerts();
        setAlerts(data);
      } catch (e) {
        console.error('Failed to load alerts for header', e);
      }
    }
    load();
    const pollId = setInterval(load, 15_000);
    return () => clearInterval(pollId);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <>
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
              <Link to="/reminders" className={`flex items-center gap-2 ${location.pathname === '/reminders' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}>
                <BellRing className="w-5 h-5" /><span>Reminders</span>
              </Link>

              {/* Notification Bell (reminder alerts dropdown) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="relative text-text-primary hover:text-primary transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-negative rounded-full text-xs flex items-center justify-center text-white font-medium">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-[min(400px,70vh)] bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="font-semibold text-text-primary">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-xs text-text-secondary">{unreadCount} unread</span>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {alerts.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-text-secondary">
                          No reminder alerts yet. Set reminders on the Reminders page.
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {alerts.slice(0, 10).map((alert) => (
                            <li key={alert.id} className="px-4 py-3 hover:bg-background/50">
                              <div className="flex items-start gap-2">
                                {!alert.is_read && (
                                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-text-primary">{alert.ticker}</p>
                                  <p className="text-xs text-text-secondary line-clamp-2">{alert.message}</p>
                                  <p className="text-xs text-text-secondary/80 mt-0.5">
                                    {new Date(alert.triggered_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="p-2 border-t border-border">
                      <Link
                        to="/reminders"
                        onClick={() => setDropdownOpen(false)}
                        className="block text-center text-sm text-primary hover:underline py-1"
                      >
                        View all reminders →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Account */}
              <button
                onClick={() => setIsAccountOpen(true)}
                className={`flex items-center gap-1.5 text-text-primary hover:text-primary transition-colors ${isAccountOpen ? 'text-primary' : ''}`}
              >
                <User className="w-5 h-5" />
                <span>Account</span>
              </button>
            </nav>
          </div>
        </div>
      </header>
      <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
    </>
  );
};

export default Header;
