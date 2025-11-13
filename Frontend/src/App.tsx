import React from 'react';
import Header from './components/Header';
import StockDetailHeader from './components/StockDetailHeader';
import PortfolioChart from './components/PortfolioChart';
import StockWatchlist from './components/StockWatchlist';
import StockAbout from './components/StockAbout';
import KeyStatistics from './components/KeyStatistics';
import RelatedLists from './components/RelatedLists';
import NewsSection from './components/NewsSection';
import TradingTrends from './components/TradingTrends';
import { featuredStock, stockNewsArticles, tradingTrendsData } from './data/demoData';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-[1920px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Stock Detail */}
          <div className="lg:col-span-2 space-y-6">
            <StockDetailHeader
              symbol={featuredStock.symbol}
              companyName={featuredStock.companyName}
              price={featuredStock.price}
              change={featuredStock.change}
              changePercent={featuredStock.changePercent}
              marketStatus={featuredStock.marketStatus}
            />
            
            <PortfolioChart showExtendedPeriods={true} />
            
            <StockAbout
              description={featuredStock.about.description}
              companyInfo={featuredStock.about.companyInfo}
            />
            
            <KeyStatistics stats={featuredStock.statistics} />
            
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
      </main>
    </div>
  );
}

export default App;

