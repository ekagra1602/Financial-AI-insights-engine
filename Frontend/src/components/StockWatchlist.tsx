import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, Zap, Plus } from 'lucide-react';
import { StockData } from '../types';
import { stockWatchlist } from '../data/demoData';
import { fetchKeyStatistics } from '../services/api';
import Sparkline from './Sparkline';

// Cache for stock data to prevent re-fetching on navigation
let cachedStocks: StockData[] | null = null;
let isWatchlistFetching = false;

const StockWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<StockData[]>(cachedStocks || stockWatchlist);
  const [isAdding, setIsAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
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

  const handleAddStock = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSymbol) {
      const symbol = newSymbol.toUpperCase();
      
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
        // In a real app, show an error toast
      }
    }
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
        onClick={() => navigate(`/stock/${stock.symbol}`)}
        className="flex items-center justify-between py-3 hover:bg-surface-light px-3 -mx-3 rounded-lg transition-colors cursor-pointer"
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
        <div className="mb-4 px-1">
          <input
            autoFocus
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={handleAddStock}
            placeholder="Symbol (e.g. MSFT)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary placeholder-text-secondary"
          />
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

