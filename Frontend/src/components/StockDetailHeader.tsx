import React from 'react';
import { Bell, Maximize2 } from 'lucide-react';

interface StockDetailHeaderProps {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  marketStatus?: string;
}

const StockDetailHeader: React.FC<StockDetailHeaderProps> = ({
  symbol,
  companyName,
  price,
  change,
  changePercent,
  marketStatus = '24 Hour Market',
}) => {
  const isNegative = change < 0;

  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">{companyName}</h1>
        <div className="text-5xl font-bold text-text-primary mb-2">
          ${price.toFixed(2)}
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-base font-medium ${isNegative ? 'text-negative' : 'text-positive'}`}>
            {isNegative ? '' : '+'}{change.toFixed(2)} ({isNegative ? '' : '+'}{changePercent.toFixed(2)}%) Today
          </div>
          {marketStatus && (
            <div className="text-text-secondary text-sm">
              {marketStatus}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg border border-border hover:bg-surface-light transition-colors">
          <Bell className="w-5 h-5 text-text-primary" />
        </button>
        <button className="px-4 py-2 rounded-lg border border-border hover:bg-surface-light transition-colors flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-text-primary" />
          <span className="text-text-primary font-medium">Advanced</span>
        </button>
      </div>
    </div>
  );
};

export default StockDetailHeader;

