import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StockDetailHeader from '../components/StockDetailHeader';
import StockChart from '../components/StockChart';
import StockAbout from '../components/StockAbout';
import KeyStatistics from '../components/KeyStatistics';
import { featuredStock } from '../data/demoData';
import { fetchKeyStatistics } from '../services/api';
import { KeyStatistics as KeyStatisticsType } from '../types';

export const StockDetailPage: React.FC = () => {
    const { symbol } = useParams<{ symbol: string }>();
    const [keyStats, setKeyStats] = useState<KeyStatisticsType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (symbol) {
                try {
                    setLoading(true);
                    const stats = await fetchKeyStatistics(symbol);
                    setKeyStats(stats);
                } catch (error) {
                    console.error("Failed to load stats", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadData();
    }, [symbol]);

    if (loading) {
        return <div className="p-8 text-center text-text-primary">Loading stock data...</div>;
    }

    return (
        <div className="max-w-[1920px] mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - Stock Detail */}
                <div className="lg:col-span-2 space-y-6">
                    <StockDetailHeader
                        symbol={symbol || featuredStock.symbol}
                        companyName={keyStats?.name || featuredStock.companyName}
                        price={keyStats?.current_price || featuredStock.price}
                        change={keyStats?.current_price && keyStats?.prev_close_price ? keyStats.current_price - keyStats.prev_close_price : featuredStock.change}
                        changePercent={keyStats?.current_price && keyStats?.prev_close_price ? ((keyStats.current_price - keyStats.prev_close_price) / keyStats.prev_close_price) * 100 : featuredStock.changePercent}
                        marketStatus={featuredStock.marketStatus}
                    />

                    <StockChart symbol={symbol || featuredStock.symbol} />

                    <StockAbout
                        description={keyStats?.description || `Company profile for ${keyStats?.name || symbol}. Industry: ${keyStats?.finnhubIndustry || 'N/A'}. Country: ${keyStats?.country || 'N/A'}.`}
                        companyInfo={[
                            { label: 'CEO', value: 'N/A' },
                            { label: 'Employees', value: 'N/A' },
                            { label: 'Headquarters', value: keyStats?.country || 'N/A' },
                            { label: 'Founded', value: keyStats?.ipo || 'N/A' },
                        ]}
                    />

                    <KeyStatistics stats={keyStats || undefined} />
                </div>
            </div>
        </div>
    );
};
