import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StockDetailHeader from '../components/StockDetailHeader';
import PortfolioChart from '../components/PortfolioChart';
import StockAbout from '../components/StockAbout';
import KeyStatistics from '../components/KeyStatistics';
import RelatedLists from '../components/RelatedLists';
import NewsSection from '../components/NewsSection';
import TradingTrends from '../components/TradingTrends';
import StockWatchlist from '../components/StockWatchlist';
import { featuredStock, stockNewsArticles, tradingTrendsData } from '../data/demoData';
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

    // Transform API data to component format
    const formattedStats = keyStats ? [
        { label: 'Market cap', value: keyStats.market_cap ? `$${(keyStats.market_cap / 1000).toFixed(2)}B` : '-' },
        { label: 'Price-Earnings ratio', value: keyStats.pe_ratio ? keyStats.pe_ratio.toFixed(2) : '-' },
        { label: 'Dividend yield', value: keyStats.dividend_yield ? `${keyStats.dividend_yield.toFixed(2)}%` : '-' },
        { label: 'Average volume', value: keyStats.average_volume ? `${(keyStats.average_volume / 1000000).toFixed(2)}M` : '-' },
        { label: 'High today', value: keyStats.high_today ? `$${keyStats.high_today.toFixed(2)}` : '-' },
        { label: 'Low today', value: keyStats.low_today ? `$${keyStats.low_today.toFixed(2)}` : '-' },
        { label: 'Open price', value: keyStats.open_price ? `$${keyStats.open_price.toFixed(2)}` : '-' },
        { label: 'Volume', value: keyStats.volume ? `${(keyStats.volume / 1000000).toFixed(2)}M` : '-' },
        { label: '52 Week high', value: keyStats.fifty_two_week_high ? `$${keyStats.fifty_two_week_high.toFixed(2)}` : '-' },
        { label: '52 Week low', value: keyStats.fifty_two_week_low ? `$${keyStats.fifty_two_week_low.toFixed(2)}` : '-' },
    ] : featuredStock.statistics; // Fallback to demo data if fetch fails or loading

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

                    <PortfolioChart showExtendedPeriods={true} />

                    <StockAbout
                        description={keyStats?.description || `Company profile for ${keyStats?.name || symbol}. Industry: ${keyStats?.finnhubIndustry || 'N/A'}. Country: ${keyStats?.country || 'N/A'}.`}
                        companyInfo={{
                            ceo: 'N/A', // Not in profile2
                            employees: 'N/A', // Not in profile2
                            headquarters: keyStats?.country || 'N/A',
                            founded: keyStats?.ipo || 'N/A',
                        }}
                    />

                    <KeyStatistics stats={formattedStats} />

                    <RelatedLists />

                    <NewsSection articles={stockNewsArticles} />

                    <TradingTrends
                        data={tradingTrendsData}
                        changePercent={-0.04}
                        lastUpdated="Nov 5"
                    />
                </div>

                {/* Sidebar - Stock Watchlist */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24">
                        <StockWatchlist />
                    </div>
                </div>
            </div>
        </div>
    );
};
