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

  // Navigation items for reuse in both top nav and bottom tab bar
  const navItems = [
    { to: '/', label: 'Dashboard', icon: Home, match: (p: string) => p === '/' },
    { to: '/web-search', label: 'Search', icon: Search, match: (p: string) => p === '/web-search' },
    { to: '/news', label: 'News', icon: Newspaper, match: (p: string) => p.includes('/news') },
    { to: '/sentiment-reports', label: 'Insights', icon: TrendingUp, match: (p: string) => p.includes('/sentiment-reports') },
    { to: '/chatbot', label: 'Chatbot', icon: MessageSquare, match: (p: string) => p === '/chatbot' },
    { to: '/reminders', label: 'Reminders', icon: BellRing, match: (p: string) => p === '/reminders' },
  ];

  return (
    <>
      {/* ═══════════ TOP HEADER BAR ═══════════ */}
      <header className="bg-surface border-b border-border sticky top-0 z-50 safe-area-top">
        <div className="max-w-[1920px] mx-auto px-3 md:px-6 py-2.5 md:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4 md:gap-8">
              <Link to="/" className="flex items-center gap-2 md:gap-3">
                <img src="/Qualcomm.png" alt="Qualcomm Logo" className="h-6 md:h-8 w-auto" />
                <div className="text-text-primary font-semibold text-sm md:text-lg hidden sm:block">Financial Insights Engine</div>
              </Link>
            </div>

            {/* Desktop Navigation — hidden on mobile */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 ${item.match(location.pathname) ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}
                >
                  <item.icon className="w-5 h-5" /><span>{item.label}</span>
                </Link>
              ))}

              {/* Notification Bell */}
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

            {/* Mobile right icons — visible only on mobile */}
            <div className="flex md:hidden items-center gap-3">
              {/* Notification Bell (mobile) */}
              <div className="relative" ref={!dropdownOpen ? undefined : dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="relative text-text-primary hover:text-primary transition-colors p-1"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-negative rounded-full text-[10px] flex items-center justify-center text-white font-medium">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Account (mobile) */}
              <button
                onClick={() => setIsAccountOpen(true)}
                className="text-text-primary hover:text-primary transition-colors p-1"
              >
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile notification dropdown — full width */}
        {dropdownOpen && (
          <div className="md:hidden border-t border-border" ref={dropdownRef}>
            <div className="max-h-[50vh] bg-surface overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-text-secondary">{unreadCount} unread</span>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-text-secondary">
                    No reminder alerts yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {alerts.slice(0, 10).map((alert) => (
                      <li key={alert.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {!alert.is_read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary">{alert.ticker}</p>
                            <p className="text-xs text-text-secondary line-clamp-2">{alert.message}</p>
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
          </div>
        )}
      </header>

      {/* ═══════════ MOBILE BOTTOM TAB BAR ═══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.map((item) => {
            const isActive = item.match(location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
                  isActive ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
    </>
  );
};

export default Header;
