import React, { useEffect, useState, useRef } from 'react';
import { fetchKeyStatistics } from '../services/api';
import { KeyStatistics } from '../types';

interface CompanyStatsProps {
    symbol: string;
}

export const CompanyStats: React.FC<CompanyStatsProps> = ({ symbol }) => {
    const [stats, setStats] = useState<KeyStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Cancel previous request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const loadStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchKeyStatistics(symbol);
                if (controller.signal.aborted) return;
                setStats(data);
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("Failed to fetch stats", err);
                setError("Failed to load statistics");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        if (symbol) {
            loadStats();
        }

        return () => controller.abort();
    }, [symbol]);

    if (loading) {
        return (
            <div className="w-full bg-surface rounded-xl border border-border p-6 shadow-lg animate-pulse">
                <div className="h-6 w-1/3 bg-background rounded mb-4"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-background rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full bg-surface rounded-xl border border-border p-6 shadow-lg text-center text-text-secondary">
                <p>Could not load statistics. Try again later.</p>
            </div>
        );
    }

    if (!stats) return null;

    // Format helpers
    const formatNumber = (num: number | null | undefined) => {
        if (num === null || num === undefined) return '-';
        return new Intl.NumberFormat('en-US', {
            notation: "compact",
            maximumFractionDigits: 2
        }).format(num);
    };

    const formatCurrency = (num: number | null | undefined) => {
        if (num === null || num === undefined) return '-';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    };

    const StatItem = ({ label, value }: { label: string, value: string }) => (
        <div className="flex flex-col">
            <span className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</span>
            <span className="text-lg font-semibold text-text-primary">{value}</span>
        </div>
    );

    return (
        <div className="w-full bg-surface rounded-xl border border-border p-6 shadow-lg">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex justify-between items-center">
                <span>Key Statistics</span>
                {stats.finnhubIndustry && (
                    <span className="text-xs font-normal px-2 py-1 bg-surface-light rounded-full text-text-secondary">
                        {stats.finnhubIndustry}
                    </span>
                )}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatItem label="Market Cap" value={formatNumber(stats.marketCapitalization)} />
                <StatItem label="P/E Ratio" value={stats.pe_ratio?.toFixed(2) || '-'} />
                <StatItem label="Div Yield" value={stats.dividend_yield ? `${stats.dividend_yield.toFixed(2)}%` : '-'} />
                <StatItem label="Avg Volume" value={formatNumber(stats.average_volume)} />

                <StatItem label="High (Today)" value={formatCurrency(stats.high_today)} />
                <StatItem label="Low (Today)" value={formatCurrency(stats.low_today)} />
                <StatItem label="52W High" value={formatCurrency(stats.fifty_two_week_high)} />
                <StatItem label="52W Low" value={formatCurrency(stats.fifty_two_week_low)} />
            </div>
        </div>
    );
};
