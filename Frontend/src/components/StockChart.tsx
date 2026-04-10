import React, { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import { fetchStockHistory, fetchStockEventNews } from '../services/api';
import { ChartEvent, StockDataPoint } from '../types';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface StockChartProps {
    symbol: string;
    companyName?: string;
    isInWatchlist?: boolean;
    onToggleWatchlist?: () => void;
}

const timeframes = ['1D', '5D', '1M', '3M', '1Y', '5Y'];

export const StockChart: React.FC<StockChartProps> = ({ symbol, companyName, isInWatchlist, onToggleWatchlist }) => {
    const [data, setData] = useState<StockDataPoint[]>([]);
    const [chartEvents, setChartEvents] = useState<ChartEvent[]>([]);
    const [timeframe, setTimeframe] = useState('1D');
    const [loading, setLoading] = useState(false);
    const [eventNewsLoading, setEventNewsLoading] = useState(false);
    const [eventNews, setEventNews] = useState<Record<string, { headline: string | null; summary: string | null; url: string | null; source: string | null }>>({});
    const intervalRef = useRef<number | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: history, events } = await fetchStockHistory(symbol, timeframe);
            setData(history);
            setChartEvents(events ?? []);
        } catch (error) {
            console.error("Failed to load stock data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(loadData, 300000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [symbol, timeframe]);

    const eventDatesKey = chartEvents.map((e) => `${e.event_date}:${e.time}`).join('|');

    useEffect(() => {
        if (!symbol || chartEvents.length === 0) {
            setEventNews({});
            return;
        }
        const dates = chartEvents.map((e) => e.event_date);
        let cancelled = false;
        setEventNewsLoading(true);
        fetchStockEventNews(symbol, dates)
            .then((rows) => {
                if (cancelled) return;
                const m: Record<string, { headline: string | null; summary: string | null; url: string | null; source: string | null }> = {};
                for (const r of rows) {
                    m[r.event_date] = {
                        headline: r.headline,
                        summary: r.summary,
                        url: r.url,
                        source: r.source,
                    };
                }
                setEventNews(m);
            })
            .catch((err) => console.error('Event news fetch failed', err))
            .finally(() => {
                if (!cancelled) setEventNewsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [symbol, eventDatesKey]);

    const isPositive = data.length > 0 && (data[data.length - 1].close >= data[0].open);
    const lineColor = isPositive ? '#00c805' : '#ff5000';

    const priceChange = data.length > 0 ? data[data.length - 1].close - data[0].open : 0;
    const percentChange = data.length > 0 && data[0].open !== 0
        ? (priceChange / data[0].open) * 100
        : 0;

    const xData = data.map(d => d.time);
    const yData = data.map(d => d.close);

    const prices = data.map(d => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.05;

    const yRange = data.length > 0
        ? [minPrice - padding, maxPrice + padding]
        : undefined;

    const eventHoverLines = chartEvents.map((ev) => {
        const n = eventNews[ev.event_date];
        let line = n?.headline?.trim();
        if (!line) {
            line = eventNewsLoading ? 'Loading headline…' : (n?.summary?.trim() || 'No article for this date');
        }
        return `${ev.label}<br>${line}<br>${ev.pct_change >= 0 ? '+' : ''}${ev.pct_change.toFixed(2)}%`;
    });

    const plotData: Record<string, unknown>[] = [
        {
            x: xData,
            y: yData,
            type: 'scatter',
            mode: 'lines',
            line: { color: lineColor, width: 2 },
            fill: 'tozeroy',
            fillcolor: isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)',
            name: 'Price',
            hovertemplate: '<b>%{y:.2f}</b><extra></extra>',
        },
    ];

    if (chartEvents.length > 0) {
        plotData.push({
            x: chartEvents.map((e) => e.time),
            y: chartEvents.map((e) => e.price),
            type: 'scatter',
            mode: 'markers+text',
            name: 'Events',
            text: chartEvents.map((e) => e.label),
            textposition: 'top center',
            textfont: { color: '#aaa', size: 11 },
            marker: {
                size: 11,
                color: 'rgba(0,0,0,0.35)',
                line: { color: lineColor, width: 2 },
            },
            hovertemplate: '%{customdata}<extra></extra>',
            customdata: eventHoverLines,
        });
    }

    return (
        <div className="w-full p-4 bg-surface rounded-xl shadow-lg border border-border">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div>
                            {companyName ? (
                                <>
                                    <h2 className="text-xl font-bold text-text-primary leading-tight">{companyName}</h2>
                                    <span className="text-xs font-semibold text-text-secondary tracking-widest uppercase">{symbol}</span>
                                </>
                            ) : (
                                <h2 className="text-3xl font-bold text-text-primary tracking-widest">{symbol}</h2>
                            )}
                        </div>
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
                    {data.length > 0 && (
                        <div className={clsx("text-sm font-medium mt-0.5", isPositive ? "text-positive" : "text-negative")}>
                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}&nbsp;
                            ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%)&nbsp;
                            <span className="text-text-secondary font-normal">{timeframe}</span>
                        </div>
                    )}
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

            <div className="relative w-full h-[340px] sm:h-[380px] lg:h-[440px]">
                {(loading && data.length === 0) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-surface/50 backdrop-blur-sm rounded-xl">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
                        <div className="text-sm font-medium text-text-secondary animate-pulse">
                            Loading market data...
                        </div>
                    </div>
                )}
                {(loading && data.length > 0) && (
                    <div className="absolute top-2 right-2 z-10">
                        <RefreshCw className="w-4 h-4 animate-spin text-text-secondary" />
                    </div>
                )}
                <Plot
                    data={plotData}
                    layout={{
                        autosize: true,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        margin: { l: 40, r: 20, t: 20, b: 40 },
                        showlegend: false,
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
                        hovermode: 'closest',
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

            {chartEvents.length > 0 && (
                <div className="mt-4 border-t border-border pt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-text-primary">Events &amp; news</h3>
                    <p className="text-xs text-text-secondary">
                        Markers show large moves in this range. Headlines load only for these dates (cached separately from the main news feed).
                    </p>
                    <ul className="space-y-3">
                        {chartEvents.map((ev) => {
                            const n = eventNews[ev.event_date];
                            return (
                                <li key={`${ev.event_date}-${ev.label}`} className="text-sm border border-border rounded-lg p-3 bg-surface-light/30">
                                    <div className="font-medium text-text-primary">
                                        {ev.label}
                                        <span className="text-text-secondary font-normal"> · {ev.event_date}</span>
                                        <span className={clsx('ml-2', ev.pct_change >= 0 ? 'text-positive' : 'text-negative')}>
                                            {ev.pct_change >= 0 ? '+' : ''}{ev.pct_change.toFixed(2)}%
                                        </span>
                                    </div>
                                    {eventNewsLoading && !n && (
                                        <div className="text-text-secondary text-xs mt-1 animate-pulse">Loading…</div>
                                    )}
                                    {n?.headline && (
                                        <a
                                            href={n.url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 block text-primary hover:underline leading-snug"
                                        >
                                            {n.headline}
                                        </a>
                                    )}
                                    {!eventNewsLoading && n && !n.headline && n.summary && (
                                        <p className="text-text-secondary text-xs mt-1">{n.summary}</p>
                                    )}
                                    {n?.source && (
                                        <span className="text-xs text-text-secondary mt-1 block">{n.source}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="mt-4 text-xs text-center text-text-secondary">
                Updates every 5 minutes • Data from TwelveData
            </div>
        </div>
    );
};
