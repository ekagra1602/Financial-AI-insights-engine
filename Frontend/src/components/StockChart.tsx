import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Settings } from 'lucide-react';

interface StockChartProps {
    symbol: string;
}

type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'MAX';

const timePeriods: TimePeriod[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'];

const StockChart: React.FC<StockChartProps> = ({ symbol }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1D');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Calculate from/to timestamps based on selectedPeriod
                const to = Math.floor(Date.now() / 1000);
                let from = to;
                let resolution = 'D';

                switch (selectedPeriod) {
                    case '1D':
                        from = to - 86400;
                        resolution = '15'; // 15 min candles for 1 day
                        break;
                    case '1W':
                        from = to - 7 * 86400;
                        resolution = '60'; // 1 hour candles for 1 week
                        break;
                    case '1M':
                        from = to - 30 * 86400;
                        resolution = 'D';
                        break;
                    case '3M':
                        from = to - 90 * 86400;
                        resolution = 'D';
                        break;
                    case 'YTD':
                        from = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
                        resolution = 'D';
                        break;
                    case '1Y':
                        from = to - 365 * 86400;
                        resolution = 'D';
                        break;
                    case '5Y':
                        from = to - 5 * 365 * 86400;
                        resolution = 'W';
                        break;
                    case 'MAX':
                        from = to - 20 * 365 * 86400; // 20 years approx
                        resolution = 'M';
                        break;
                }

                console.log('Fetching candles:', `symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
                const response = await fetch(`http://localhost:8000/api/v1/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
                if (response.ok) {
                    const result = await response.json();
                    console.log('Candles result:', result);
                    if (result.s === 'ok' && result.c && result.t) {
                        const formattedData = result.t.map((timestamp: number, index: number) => ({
                            timestamp: timestamp * 1000,
                            value: result.c[index],
                        }));
                        console.log('Formatted data:', formattedData);
                        setData(formattedData);
                    } else {
                        console.warn('Candles data not ok or empty:', result);
                        setData([]);
                    }
                } else {
                    console.error('Failed to fetch candles:', response.status);
                }
            } catch (error) {
                console.error('Failed to fetch chart data', error);
            } finally {
                setLoading(false);
            }
        };

        if (symbol) {
            fetchData();
        }
    }, [symbol, selectedPeriod]);

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
                {loading ? (
                    <div className="flex items-center justify-center h-full text-text-secondary">Loading chart...</div>
                ) : data.length > 0 ? (
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
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#2a2b2c"
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                domain={['dataMin', 'dataMax']}
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
                ) : (
                    <div className="flex items-center justify-center h-full text-text-secondary">No data available</div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex gap-2 flex-wrap">
                    {timePeriods.map((period) => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selectedPeriod === period
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

export default StockChart;
// Refreshed
