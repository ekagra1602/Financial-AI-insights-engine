import React from 'react';
import { KeyStatistics as KeyStatisticsType } from '../types';

interface KeyStatisticsProps {
  stats?: KeyStatisticsType;
}

const KeyStatistics: React.FC<KeyStatisticsProps> = ({ stats }) => {
  if (!stats) return null;

  const displayStats = [
    { label: 'Market Cap', value: stats.market_cap ? `${stats.market_cap}M` : 'N/A' },
    { label: 'P/E Ratio', value: stats.pe_ratio?.toFixed(2) || 'N/A' },
    { label: 'Dividend Yield', value: stats.dividend_yield ? `${stats.dividend_yield.toFixed(2)}%` : 'N/A' },
    { label: 'Avg Volume', value: stats.average_volume ? `${(stats.average_volume / 1000000).toFixed(2)}M` : 'N/A' },
    { label: 'High Today', value: stats.high_today ? `$${stats.high_today.toFixed(2)}` : 'N/A' },
    { label: 'Low Today', value: stats.low_today ? `$${stats.low_today.toFixed(2)}` : 'N/A' },
    { label: 'Open Price', value: stats.open_price ? `$${stats.open_price.toFixed(2)}` : 'N/A' },
    { label: '52W High', value: stats.fifty_two_week_high ? `$${stats.fifty_two_week_high.toFixed(2)}` : 'N/A' },
    { label: '52W Low', value: stats.fifty_two_week_low ? `$${stats.fifty_two_week_low.toFixed(2)}` : 'N/A' },
  ];

  return (
    <div className="bg-surface rounded-xl p-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">Key statistics</h2>

      <div className="border-b border-border mb-6"></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
        {displayStats.map((stat, index) => (
          <div key={index}>
            <div className="text-text-secondary text-sm mb-1">{stat.label}</div>
            <div className="text-text-primary font-medium">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyStatistics;

