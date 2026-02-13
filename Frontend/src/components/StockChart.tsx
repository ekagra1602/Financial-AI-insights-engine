import React, { useEffect, useState, useRef, useCallback } from 'react';
import Plot from 'react-plotly.js';
import { fetchStockHistory } from '../services/api';
import { StockDataPoint } from '../types';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface StockChartProps {
    symbol: string;
    isInWatchlist?: boolean;
    onToggleWatchlist?: () => void;
}

const timeframes = ['1D', '5D', '1M', '3M', '1Y', '5Y'];

export const StockChart: React.FC<StockChartProps> = ({ symbol, isInWatchlist, onToggleWatchlist }) => {
    const [data, setData] = useState<StockDataPoint[]>([]);
    const [timeframe, setTimeframe] = useState('1D');
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const loadData = useCallback(async (sig?: AbortSignal) => {
        setLoading(true);
        try {
            const history = await fetchStockHistory(symbol, timeframe);
            if (sig?.aborted) return; // Don't update state if aborted
            setData(history);
        } catch (error) {
            if (sig?.aborted) return;
            console.error("Failed to load stock data", error);
        } finally {
            if (!sig?.aborted) setLoading(false);
        }
    }, [symbol, timeframe]);

    useEffect(() => {
        // Cancel any previous in-flight request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        loadData(controller.signal);

        // Polling every 5 mins
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(() => loadData(controller.signal), 300000);

        return () => {
            controller.abort();
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadData]);

    // Determine color
    const isPositive = data.length > 0 && (data[data.length - 1].close >= data[0].open);
    const lineColor = isPositive ? '#00c805' : '#ff5000';

    const xData = data.map(d => d.time);
    const yData = data.map(d => d.close);

    // Calculate dynamic Y-axis range
    const prices = data.map(d => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.05;

    const yRange = data.length > 0
        ? [minPrice - padding, maxPrice + padding]
        : undefined;

    return (
        <div className="w-full h-full p-4 bg-surface rounded-xl shadow-lg border border-border flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-text-primary tracking-widest">{symbol}</h2>
                        {onToggleWatchlist && (
                            <button
                                onClick={onToggleWatchlist}
                                className={clsx(
                                    "p-2 rounded-full transition-colors",
                                    isInWatchlist ? "text-yellow-400 hover:bg-yellow-400/10" : "text-text-secondary hover:text-text-primary hover:bg-surface-light"
                                )}
                                title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isInWatchlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </button>
                        )}
                    </div>
                    <div className={clsx("text-xl font-medium", isPositive ? "text-positive" : "text-negative")}>
                        ${data.length > 0 ? data[data.length - 1].close.toFixed(2) : '0.00'}
                    </div>
                </div>
                <div className="flex space-x-1">
                    {timeframes.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={twMerge(
                                "px-3 py-1 rounded-full text-sm font-semibold transition-all",
                                timeframe === tf
                                    ? "bg-text-primary text-background"
                                    : "text-text-secondary hover:text-text-primary hover:bg-surface-light"
                            )}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative w-full flex-1 min-h-0">
                {(loading || data.length === 0) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-surface/50 backdrop-blur-sm rounded-xl">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
                        <div className="text-sm font-medium text-text-secondary animate-pulse">
                            Loading market data...
                        </div>
                    </div>
                )}
                <Plot
                    data={[
                        {
                            x: xData,
                            y: yData,
                            type: 'scatter',
                            mode: 'lines',
                            line: { color: lineColor, width: 2 },
                            fill: 'tozeroy',
                            fillcolor: isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)',
                        },
                    ]}
                    layout={{
                        autosize: true,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        margin: { l: 40, r: 20, t: 20, b: 40 },
                        xaxis: {
                            showgrid: false,
                            zeroline: false,
                            showline: false,
                            color: '#666',
                            tickfont: { color: '#666' },
                            tickformat: '%b %d %Y %H:%M',
                            rangebreaks: [
                                { bounds: ['sat', 'mon'] },
                                ...(['1D', '5D', '1M', '3M'].includes(timeframe) ? [
                                    { bounds: [16, 9.5], pattern: 'hour' as const }
                                ] : [])
                            ]
                        },
                        yaxis: {
                            showgrid: true,
                            gridcolor: '#333',
                            zeroline: false,
                            color: '#666',
                            tickfont: { color: '#666' },
                            range: yRange,
                        },
                        dragmode: false,
                        hovermode: 'x unified',
                        hoverlabel: {
                            bgcolor: '#1E1E1E',
                            bordercolor: '#333',
                            font: { color: '#FFF' }
                        }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                />
            </div>

            <div className="mt-4 text-xs text-center text-text-secondary">
                Updates every 5 minutes • Data from TwelveData
            </div>
        </div>
    );
};
