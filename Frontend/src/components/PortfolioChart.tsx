import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Settings } from 'lucide-react';
import { TimePeriod, PortfolioDataPoint } from '../types';
import { portfolioData } from '../data/demoData';

interface StockChartProps {
  showExtendedPeriods?: boolean;
}

const timePeriods: TimePeriod[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];
const extendedTimePeriods = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'] as const;
type ExtendedTimePeriod = typeof extendedTimePeriods[number];

const PortfolioChart: React.FC<StockChartProps> = ({ showExtendedPeriods = false }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1D');
  const periods = showExtendedPeriods ? extendedTimePeriods : timePeriods;
  const data = portfolioData[selectedPeriod as TimePeriod] || portfolioData['1D'];

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (selectedPeriod === '1D') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-surface-light px-3 py-2 rounded-lg border border-border">
          <p className="text-text-primary font-semibold">
            ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-text-secondary text-xs">
            {new Date(payload[0].payload.timestamp).toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface rounded-xl p-6 mb-6">
      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff5000" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff5000" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#2a2b2c"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="#2a2b2c"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ff5000"
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex gap-2">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as TimePeriod)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-surface-light text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
        <button className="text-text-secondary hover:text-text-primary transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default PortfolioChart;

