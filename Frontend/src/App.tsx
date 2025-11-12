import { useState } from 'react';
import Header from './components/Header';
import StockDetailHeader from './components/StockDetailHeader';
import PortfolioChart from './components/PortfolioChart';
import StockWatchlist from './components/StockWatchlist';
import StockAbout from './components/StockAbout';
import KeyStatistics from './components/KeyStatistics';
import RelatedLists from './components/RelatedLists';
import NewsSection from './components/NewsSection';
import TradingTrends from './components/TradingTrends';
import SentimentContainer from './components/SentimentContainer';
import { featuredStock, stockNewsArticles, tradingTrendsData } from './data/demoData';

type Page = 'stock-detail' | 'sentiment-reports';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('sentiment-reports');
  const [searchedTicker, setSearchedTicker] = useState<string | null>(null);

  const handleSearch = (ticker: string) => {
    setSearchedTicker(ticker);
    // Automatically switch to sentiment reports page when searching
    setCurrentPage('sentiment-reports');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={handleSearch} />
      
      {/* Page Navigation */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-[1920px] mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage('stock-detail')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                currentPage === 'stock-detail'
                  ? 'text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Stock Details
              {currentPage === 'stock-detail' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setCurrentPage('sentiment-reports')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                currentPage === 'sentiment-reports'
                  ? 'text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sentiment Reports
              {currentPage === 'sentiment-reports' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {currentPage === 'sentiment-reports' ? (
        <SentimentContainer ticker={searchedTicker} />
      ) : (
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
      )}
    </div>
  );
}

export default App;
