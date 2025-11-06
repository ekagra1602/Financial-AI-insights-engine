import React, { useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Info } from 'lucide-react';

interface TradingData {
  date: string;
  netBuyVolume: number;
  netSellVolume: number;
  stockPrice: number;
}

interface TradingTrendsProps {
  data: TradingData[];
  changePercent: number;
  lastUpdated: string;
}

const TradingTrends: React.FC<TradingTrendsProps> = ({ data, changePercent, lastUpdated }) => {
  const [activeTab, setActiveTab] = useState<'robinhood' | 'hedge' | 'insiders'>('robinhood');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-light px-4 py-3 rounded-lg border border-border">
          <p className="text-text-primary font-semibold mb-1">
            {payload[0].payload.date}
          </p>
          <p className="text-positive text-sm">
            Buy: {Math.abs(payload[0].value).toFixed(1)}%
          </p>
          <p className="text-negative text-sm">
            Sell: {Math.abs(payload[1].value).toFixed(1)}%
          </p>
          <p className="text-text-secondary text-sm">
            Price: ${payload[2].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">Trading Trends</h2>
        <button className="text-text-secondary hover:text-text-primary transition-colors">
          <Info className="w-5 h-5" />
        </button>
      </div>
      
      <div className="border-b border-border mb-6"></div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('robinhood')}
          className={`pb-3 font-medium transition-colors relative ${
            activeTab === 'robinhood'
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Robinhood
          {activeTab === 'robinhood' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-negative"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('hedge')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'hedge'
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Hedge funds
        </button>
        <button
          onClick={() => setActiveTab('insiders')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'insiders'
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Insiders
        </button>
      </div>

      {/* Description */}
      <p className="text-text-primary mb-6">
        {lastUpdated}: Our customers' <span className="font-semibold">buy</span> volume percentage{' '}
        <span className="font-semibold">
          {changePercent >= 0 ? 'increased' : 'decreased'} by {Math.abs(changePercent).toFixed(2)}%
        </span>{' '}
        vs the last trading day. This is not investment advice.
      </p>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 bg-positive rounded"></div>
          <span className="text-text-secondary text-sm">Net buy volume</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 bg-negative rounded"></div>
          <span className="text-text-secondary text-sm">Net sell volume</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-0.5 bg-blue-500"></div>
          <span className="text-text-secondary text-sm">Stock price</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <XAxis
              dataKey="date"
              stroke="#2a2b2c"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="volume"
              domain={[-50, 50]}
              ticks={[-50, 0, 50]}
              tickFormatter={(value) => `${value}%`}
              stroke="#2a2b2c"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              domain={['dataMin - 10', 'dataMax + 10']}
              tickFormatter={(value) => `$${value}`}
              stroke="#2a2b2c"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="volume" y={0} stroke="#2a2b2c" strokeDasharray="3 3" />
            <Bar
              yAxisId="volume"
              dataKey="netBuyVolume"
              fill="#00c805"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="volume"
              dataKey="netSellVolume"
              fill="#ff5000"
              radius={[0, 0, 4, 4]}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="stockPrice"
              stroke="#4a9eff"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TradingTrends;

