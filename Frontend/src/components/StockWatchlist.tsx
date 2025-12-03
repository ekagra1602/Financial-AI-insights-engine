import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, Plus, Trash2, Search } from 'lucide-react';
import { StockData } from '../types';
import Sparkline from './Sparkline';
import { useAuth } from '../context/AuthContext';

interface WatchlistItem {
  id: number;
  ticker: string;
  user_id: number;
}

interface StockWatchlistProps {
  onSelectStock?: (ticker: string) => void;
}

const StockWatchlist: React.FC<StockWatchlistProps> = ({ onSelectStock }) => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [watchlist, setWatchlist] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({
    'my-watchlist': true,
  });

  const toggleList = (listId: string) => {
    setExpandedLists((prev) => ({
      ...prev,
      [listId]: !prev[listId],
    }));
  };

  const fetchWatchlist = async () => {
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8000/api/v1/watchlist/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const items: WatchlistItem[] = await response.json();
        const stockPromises = items.map(async (item) => {
          try {
            const quoteResponse = await fetch(`http://localhost:8000/api/v1/quote?symbol=${item.ticker}`);
            if (quoteResponse.ok) {
              const quoteData = await quoteResponse.json();
              return {
                symbol: item.ticker,
                price: quoteData.current_price || 0,
                change: (quoteData.current_price || 0) - (quoteData.prev_close_price || 0),
                changePercent: ((quoteData.current_price || 0) - (quoteData.prev_close_price || 0)) / (quoteData.prev_close_price || 1) * 100,
                sparklineData: Array(20).fill(0).map(() => Math.random() * 10 + (quoteData.current_price || 100)), // Mock data
              } as StockData;
            }
          } catch (e) {
            console.error(`Failed to fetch quote for ${item.ticker}`, e);
          }
          return null;
        });

        const stocks = (await Promise.all(stockPromises)).filter((s): s is StockData => s !== null);
        setWatchlist(stocks);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [token]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/v1/search?q=${query}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.result || []);
      }
    } catch (error) {
      console.error('Search failed', error);
    }
  };

  const addToWatchlist = async (ticker: string) => {
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8000/api/v1/watchlist/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker }),
      });
      if (response.ok) {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
        fetchWatchlist();
      }
    } catch (error) {
      console.error('Failed to add to watchlist', error);
    }
  };

  const removeFromWatchlist = async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/watchlist/${ticker}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchWatchlist();
      }
    } catch (error) {
      console.error('Failed to remove from watchlist', error);
    }
  };

  const StockItem: React.FC<{ stock: StockData }> = ({ stock }) => {
    const isPositive = stock.change >= 0;
    const sparklineColor = isPositive ? '#00c805' : '#ff5000';

    return (
      <div
        onClick={() => {
          if (onSelectStock) {
            onSelectStock(stock.symbol);
          } else {
            navigate(`/stock/${stock.symbol}`);
          }
        }}
        className="flex items-center justify-between py-3 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors cursor-pointer group"
      >
        <div className="flex-1">
          <div className="font-semibold text-text-primary">{stock.symbol}</div>
        </div>
        <div className="flex items-center gap-3">
          <Sparkline data={stock.sparklineData} color={sparklineColor} width={60} height={30} />
          <div className="text-right">
            <div className="font-semibold text-text-primary">
              ${stock.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className={`text-xs ${isPositive ? 'text-positive' : 'text-negative'}`}>
              {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </div>
          </div>
          <button
            onClick={(e) => removeFromWatchlist(e, stock.symbol)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-500 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Watchlist</h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showSearch && (
        <div className="mb-4 relative">
          <div className="flex items-center bg-surface-light rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-text-secondary mr-2" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-text-primary w-full"
              autoFocus
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full bg-surface-light mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto border border-border">
              {searchResults.map((result) => (
                <button
                  key={result.symbol}
                  onClick={() => addToWatchlist(result.symbol)}
                  className="w-full text-left px-4 py-2 hover:bg-surface flex justify-between items-center"
                >
                  <span className="font-bold text-text-primary">{result.symbol}</span>
                  <span className="text-xs text-text-secondary truncate max-w-[150px]">{result.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Watchlist */}
      <div className="mb-4">
        <button
          onClick={() => toggleList('my-watchlist')}
          className="w-full flex items-center justify-between py-2 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-text-secondary" />
            <span className="text-text-primary">My Watchlist</span>
          </div>
          {expandedLists['my-watchlist'] ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </button>

        {expandedLists['my-watchlist'] && (
          <div className="mt-2">
            {loading ? (
              <div className="text-center text-text-secondary py-4">Loading...</div>
            ) : watchlist.length === 0 ? (
              <div className="text-center text-text-secondary py-4 text-sm">
                No stocks in watchlist. Click + to add.
              </div>
            ) : (
              watchlist.map((stock) => (
                <StockItem key={stock.symbol} stock={stock} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockWatchlist;
