import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SentimentReport from './SentimentReport';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import { Search, TrendingUp } from 'lucide-react';
import { SentimentReport as SentimentReportType, ForecastHorizon } from '../types';
import { fetchSentimentReport } from '../services/api';

interface SentimentContainerProps {
  ticker: string | null;
}

const SentimentContainer = ({ ticker }: SentimentContainerProps) => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [currentReport, setCurrentReport] = useState<SentimentReportType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (searchTicker: string, horizon: ForecastHorizon = '1M', force: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const report = await fetchSentimentReport(searchTicker, horizon, force);
      setCurrentReport(report);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report. Please try again.');
      // Do not clear currentReport — retain the existing report so the user
      // can still read previous data while the error is communicated.
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch report when ticker changes
  useEffect(() => {
    if (ticker) {
      fetchReport(ticker);
    }
  }, [ticker]);

  const handleRefresh = () => {
    if (ticker) {
      fetchReport(ticker, currentReport?.horizon ?? '1M', true); // bust cache
    }
  };

  const handleHorizonChange = (horizon: ForecastHorizon) => {
    if (ticker) {
      fetchReport(ticker, horizon);
    }
  };

  const handleRetry = () => {
    if (ticker) {
      fetchReport(ticker, currentReport?.horizon ?? '1M');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const newTicker = searchInput.trim().toUpperCase();
      navigate(`/sentiment-reports?ticker=${newTicker}`);
    }
  };

  // Always show search bar at the top
  const searchBar = (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-text-secondary" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Enter stock ticker (e.g., AAPL, GOOGL, MSFT)"
          className="w-full bg-surface border-2 border-border rounded-xl pl-14 pr-4 py-4 text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors text-lg"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-primary text-background px-6 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </form>
    </div>
  );

  // Show empty state when no ticker is searched
  if (!ticker && !isLoading && !currentReport) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-background">
        {searchBar}
        <div className="flex items-center justify-center px-6">
          <EmptyState
            icon={<TrendingUp className="w-16 h-16" />}
            message="Generate AI-Powered Sentiment Analysis"
            description="Enter a stock ticker above to view comprehensive forecasts, risk analysis, and key market drivers."
          />
        </div>
      </div>
    );
  }

  // Error with no existing report — full error screen
  if (error && !currentReport) {
    return (
      <div className="min-h-screen bg-background">
        {searchBar}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ErrorMessage message={error} onRetry={ticker ? handleRetry : undefined} />
        </div>
      </div>
    );
  }

  // Show report (with optional error banner when a previous report is still visible)
  return (
    <div>
      {searchBar}
      {error && currentReport && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 mb-2">
          <ErrorMessage message={error} onRetry={ticker ? handleRetry : undefined} />
        </div>
      )}
      <SentimentReport
        report={currentReport}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onHorizonChange={handleHorizonChange}
      />
    </div>
  );
};

export default SentimentContainer;

