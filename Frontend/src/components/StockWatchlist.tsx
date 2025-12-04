import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, Zap, Plus, X } from 'lucide-react';
import { StockData, StockSymbol } from '../types';
import { stockWatchlist } from '../data/demoData';
import { fetchKeyStatistics, searchStocks } from '../services/api';
import Sparkline from './Sparkline';

// Cache for stock data to prevent re-fetching on navigation
let cachedStocks: StockData[] | null = null;
let isWatchlistFetching = false;

const StockWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<StockData[]>(cachedStocks || stockWatchlist);
  const [isAdding, setIsAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [searchResults, setSearchResults] = useState<StockSymbol[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({
    'options-watchlist': false,
    'my-first-list': false,
  });

  useEffect(() => {
    // Only fetch if we don't have cached data and aren't currently fetching
    if (cachedStocks || isWatchlistFetching) return;

    const fetchStockData = async () => {
      isWatchlistFetching = true;
      try {
        const updatedStocks = await Promise.all(
          stockWatchlist.map(async (stock) => {
            try {
              const stats = await fetchKeyStatistics(stock.symbol);
              if (stats.current_price && stats.prev_close_price) {
                const price = stats.current_price;
                const change = price - stats.prev_close_price;
                const changePercent = (change / stats.prev_close_price) * 100;
                
                return {
                  ...stock,
                  price,
                  change,
                  changePercent,
                };
              }
              return stock;
            } catch (error) {
              console.error(`Failed to fetch data for ${stock.symbol}`, error);
              return stock;
            }
          })
        );
        cachedStocks = updatedStocks;
        setStocks(updatedStocks);
      } finally {
        isWatchlistFetching = false;
      }
    };

    fetchStockData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewSymbol(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.length > 1) {
      searchTimeout.current = setTimeout(async () => {
        const results = await searchStocks(value);
        setSearchResults(results.result.slice(0, 5)); // Limit to 5 results
      }, 300);
    } else {
      setSearchResults([]);
    }
  };

  const selectStock = (symbol: string) => {
    setNewSymbol(symbol);
    setSearchResults([]);
    addStock(symbol);
  };

  const addStock = async (symbolInput: string) => {
    const symbol = symbolInput.toUpperCase();
    
    // Check if already exists
    if (stocks.some(s => s.symbol === symbol)) {
      setIsAdding(false);
      setNewSymbol('');
      return;
    }

    try {
      const stats = await fetchKeyStatistics(symbol);
      
      const newStock: StockData = {
        symbol: symbol,
        price: stats.current_price || 0,
        change: (stats.current_price && stats.prev_close_price) ? stats.current_price - stats.prev_close_price : 0,
        changePercent: (stats.current_price && stats.prev_close_price) ? ((stats.current_price - stats.prev_close_price) / stats.prev_close_price) * 100 : 0,
        sparklineData: [], // Placeholder
      };

      const updatedStocks = [...stocks, newStock];
      setStocks(updatedStocks);
      cachedStocks = updatedStocks;
      setIsAdding(false);
      setNewSymbol('');
    } catch (error) {
      console.error("Invalid stock symbol");
    }
  };

  const handleAddStock = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSymbol) {
      addStock(newSymbol);
    }
  };

  const removeStock = (symbolToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    const updatedStocks = stocks.filter(s => s.symbol !== symbolToRemove);
    setStocks(updatedStocks);
    cachedStocks = updatedStocks;
  };

  const toggleList = (listId: string) => {
    setExpandedLists((prev) => ({
      ...prev,
      [listId]: !prev[listId],
    }));
  };

  const StockItem: React.FC<{ stock: StockData }> = ({ stock }) => {
    const isPositive = stock.change >= 0;
    const sparklineColor = isPositive ? '#00c805' : '#ff5000';

    return (
      <div
        className="group relative flex items-center justify-between py-3 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors cursor-pointer"
        onClick={() => navigate(`/stock/${stock.symbol}`)}
      >
        <div className="flex-1">
          <div className="font-semibold text-text-primary">{stock.symbol}</div>
          {stock.shares && (
            <div className="text-xs text-text-secondary">{stock.shares} shares</div>
          )}
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
        </div>
        {!stock.shares && (
          <button
            onClick={(e) => removeStock(stock.symbol, e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-surface text-text-secondary hover:text-negative opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            title="Remove from watchlist"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Stocks</h2>
      </div>

      {/* User's stocks */}
      <div className="mb-6">
        {stocks
          .filter((stock) => stock.shares)
          .map((stock) => (
            <StockItem key={stock.symbol} stock={stock} />
          ))}
      </div>

      {/* Lists section */}
      <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Lists</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`text-text-secondary hover:text-text-primary transition-colors ${isAdding ? 'text-primary' : ''}`}
        >
          <Plus className={`w-5 h-5 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 px-1 relative">
          <input
            autoFocus
            type="text"
            value={newSymbol}
            onChange={handleSearchChange}
            onKeyDown={handleAddStock}
            placeholder="Symbol (e.g. MSFT)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary placeholder-text-secondary"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.symbol}
                  onClick={() => selectStock(result.symbol)}
                  className="px-3 py-2 hover:bg-surface-light cursor-pointer text-sm border-b border-border last:border-0"
                >
                  <div className="font-bold text-text-primary">{result.symbol}</div>
                  <div className="text-text-secondary truncate">{result.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Options Watchlist */}
        <div className="mb-3">
          <button
            onClick={() => toggleList('options-watchlist')}
            className="w-full flex items-center justify-between py-2 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-text-secondary" />
              <span className="text-text-primary">Options Watchlist</span>
            </div>
            {expandedLists['options-watchlist'] ? (
              <ChevronUp className="w-4 h-4 text-text-secondary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            )}
          </button>
        </div>

        {/* My First List */}
        <div className="mb-4">
          <button
            onClick={() => toggleList('my-first-list')}
            className="w-full flex items-center justify-between py-2 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-text-secondary" />
              <span className="text-text-primary">My First List</span>
            </div>
            {expandedLists['my-first-list'] ? (
              <ChevronUp className="w-4 h-4 text-text-secondary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            )}
          </button>
        </div>

        {/* Watchlist stocks */}
        <div className="border-t border-border pt-3">
          {stocks
            .filter((stock) => !stock.shares)
            .map((stock) => (
              <StockItem key={stock.symbol} stock={stock} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default StockWatchlist;

