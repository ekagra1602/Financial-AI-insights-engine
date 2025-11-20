import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, Zap, Plus } from 'lucide-react';
import { StockData } from '../types';
import { stockWatchlist } from '../data/demoData';
import Sparkline from './Sparkline';

const StockWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({
    'options-watchlist': false,
    'my-first-list': false,
  });

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
        {stockWatchlist
          .filter((stock) => stock.shares)
          .map((stock) => (
            <StockItem key={stock.symbol} stock={stock} />
          ))}
      </div>

      {/* Lists section */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Lists</h3>
          <button className="text-text-secondary hover:text-text-primary transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

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
          {stockWatchlist
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

