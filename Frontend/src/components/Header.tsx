import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, MessageSquare, TrendingUp, Home, Newspaper } from 'lucide-react';

interface HeaderProps {
  onSearch?: (ticker: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Don't navigate automatically - user clicks Insights button to view report
  };

  const handleInsightsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const ticker = searchInput.trim().toUpperCase();
      navigate(`/sentiment-reports?ticker=${ticker}`);
      setSearchInput('');
      // Also call onSearch callback if provided (for backward compatibility)
      if (onSearch) {
        onSearch(ticker);
      }
    }
  };

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-3">
                <img 
                  src="/Qualcomm.png" 
                  alt="Qualcomm Logo" 
                  className="h-8 w-auto"
                />
                <div className="text-text-primary font-semibold text-lg">
                  Financial Insights Engine
                </div>
              </Link>
            </div>

            {/* Search */}
            <form onSubmit={handleSubmit} className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search stock ticker (e.g., AAPL, GOOGL, MSFT)"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
              />
            </form>
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

            <button
              onClick={handleInsightsClick}
              className={`flex items-center gap-2 bg-transparent border-none p-0 font-inherit cursor-pointer ${location.pathname.includes('/sentiment-reports') ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors ${!searchInput.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!searchInput.trim()}
              title={!searchInput.trim() ? 'Enter a stock ticker first' : 'View sentiment analysis'}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Insights</span>
            </button>

            <Link
              to="/chatbot"
              className={`flex items-center gap-2 ${location.pathname === '/chatbot' ? 'text-primary' : 'text-text-primary'} hover:text-primary transition-colors`}
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
