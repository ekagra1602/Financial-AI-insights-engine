import { useState, useEffect } from 'react';
import { Search, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { RecentSearch } from '../types';

interface SentimentHomeProps {
  onSearch: (ticker: string) => void;
}

const SentimentHome = ({ onSearch }: SentimentHomeProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const ticker = searchInput.trim().toUpperCase();
      
      // Add to recent searches
      const newSearch: RecentSearch = {
        ticker,
        companyName: ticker, // In a real app, we'd fetch the company name
        searchedAt: new Date().toISOString(),
      };

      const updated = [
        newSearch,
        ...recentSearches.filter((s) => s.ticker !== ticker),
      ].slice(0, 5);

      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));

      onSearch(ticker);
      setSearchInput('');
    }
  };

  const handleRecentClick = (ticker: string) => {
    onSearch(ticker);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Future Sentiment Analysis
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Get AI-powered insights on stock price movements with probability forecasts,
            risk analysis, and key market drivers.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-text-secondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter company name or ticker symbol (e.g., AAPL, GOOGL, MSFT)"
              className="w-full bg-surface border-2 border-border rounded-xl pl-14 pr-4 py-4 text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors text-lg"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-4 bg-primary text-background font-semibold py-4 rounded-xl hover:bg-primary/90 transition-colors text-lg"
          >
            Generate Report
          </button>
        </form>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-text-secondary" />
              <h2 className="text-text-primary font-semibold text-lg">Recent Searches</h2>
            </div>
            <div className="space-y-2">
              {recentSearches.map((search) => (
                <button
                  key={search.ticker}
                  onClick={() => handleRecentClick(search.ticker)}
                  className="w-full flex items-center justify-between p-4 bg-background rounded-lg hover:bg-surface-light transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{search.ticker}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-text-primary font-medium">{search.ticker}</div>
                      <div className="text-text-secondary text-sm">
                        {formatTimeAgo(search.searchedAt)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <div className="text-primary text-3xl font-bold mb-2">68%+</div>
            <div className="text-text-secondary text-sm">Average Prediction Accuracy</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <div className="text-primary text-3xl font-bold mb-2">5+</div>
            <div className="text-text-secondary text-sm">AI Models Combined</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <div className="text-primary text-3xl font-bold mb-2">24/7</div>
            <div className="text-text-secondary text-sm">Real-time Analysis</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentHome;

