import React from 'react';
import { ChevronDown, Gift } from 'lucide-react';

interface PortfolioHeaderProps {
  accountType: string;
  totalValue: number;
  change: number;
  changePercent: number;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  accountType,
  totalValue,
  change,
  changePercent,
}) => {
  const isNegative = change < 0;

  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-text-primary">{accountType}</h1>
          <ChevronDown className="w-5 h-5 text-text-secondary" />
        </div>
        <div className="text-5xl font-bold text-text-primary mb-2">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center gap-1 text-sm ${isNegative ? 'text-negative' : 'text-positive'}`}>
          <span>{isNegative ? '▼' : '▲'}</span>
          <span>${Math.abs(change).toFixed(2)}</span>
          <span>({Math.abs(changePercent).toFixed(2)}%)</span>
          <span className="text-text-secondary ml-1">Today</span>
        </div>
      </div>
      <button className="bg-primary text-background px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-opacity-90 transition-opacity">
        <Gift className="w-4 h-4" />
        Win gold
      </button>
    </div>
  );
};

export default PortfolioHeader;

