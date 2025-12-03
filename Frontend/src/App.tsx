import { useState, useEffect } from 'react';
import StockDetailHeader from './components/StockDetailHeader';
import StockChart from './components/StockChart';
import StockWatchlist from './components/StockWatchlist';
import StockAbout from './components/StockAbout';
import KeyStatistics from './components/KeyStatistics';
import { useAuth } from './context/AuthContext';
import { StockData } from './types';

function App() {
  const { token } = useAuth();
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStockSelect = async (ticker: string) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/quote?symbol=${ticker}`);
      if (response.ok) {
        const data = await response.json();
        // Transform API data to StockData format
        // Note: Some fields might need adjustment based on actual API response
        const stockData: StockData = {
          symbol: ticker,
          name: data.name,
          price: data.current_price,
          change: data.current_price - data.prev_close_price,
          changePercent: ((data.current_price - data.prev_close_price) / data.prev_close_price) * 100,
          sparklineData: [], // Will be handled by chart
          statistics: data,
          about: {
            description: data.description || "No description available.",
            companyInfo: [
              { label: "Industry", value: data.finnhubIndustry || "N/A" },
              { label: "Sector", value: "Technology" }, // Placeholder
              { label: "IPO Date", value: data.ipo || "N/A" },
              { label: "Exchange", value: data.exchange || "N/A" },
              { label: "Market Cap", value: data.marketCapitalization ? `${data.marketCapitalization}M` : "N/A" },
            ]
          }
        };
        setSelectedStock(stockData);
      }
    } catch (error) {
      console.error('Failed to fetch stock details', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial stock if watchlist has items
  useEffect(() => {
    const fetchFirstStock = async () => {
      if (!token) return;
      try {
        const response = await fetch('http://localhost:8000/api/v1/watchlist/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const items = await response.json();
          if (items.length > 0) {
            handleStockSelect(items[0].ticker);
          }
        }
      } catch (error) {
        console.error('Failed to fetch watchlist', error);
      }
    };
    fetchFirstStock();
  }, [token]);

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Stock Detail */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-surface rounded-xl text-text-secondary">
              Loading stock details...
            </div>
          ) : selectedStock ? (
            <>
              <StockDetailHeader
                symbol={selectedStock.symbol}
                companyName={selectedStock.name || selectedStock.symbol}
                price={selectedStock.price}
                change={selectedStock.change}
                changePercent={selectedStock.changePercent}
                marketStatus="Open" // Placeholder
              />

              <StockChart symbol={selectedStock.symbol} />

              <StockAbout
                description={selectedStock.about?.description || ""}
                companyInfo={selectedStock.about?.companyInfo || []}
              />

              <KeyStatistics stats={selectedStock.statistics} />
            </>
          ) : (
            <div className="flex items-center justify-center h-64 bg-surface rounded-xl text-text-secondary">
              Select a stock from your watchlist to view details
            </div>
          )}
        </div>

        {/* Sidebar - Stock Watchlist */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <StockWatchlist onSelectStock={handleStockSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;