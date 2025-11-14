import { useState, useEffect } from 'react';
import SentimentReport from './SentimentReport';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import { Search } from 'lucide-react';
import { SentimentReport as SentimentReportType, ForecastHorizon } from '../types';
import { demoReports } from '../data/sentimentData';

interface SentimentContainerProps {
  ticker: string | null;
}

const SentimentContainer = ({ ticker }: SentimentContainerProps) => {
  const [currentReport, setCurrentReport] = useState<SentimentReportType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate fetching a report
  const fetchReport = async (searchTicker: string, horizon: ForecastHorizon = '1M') => {
    setIsLoading(true);
    setError(null);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // In a real app, this would be an API call
      const report = demoReports[searchTicker];
      
      if (report) {
        // Update the horizon in the report
        setCurrentReport({ ...report, horizon });
      } else {
        // If ticker not found in demo data, show error
        setError(`No report available for ${searchTicker}. Try AAPL, GOOGL, or MSFT.`);
        setCurrentReport(null);
      }
    } catch (err) {
      setError('Failed to fetch report. Please try again.');
      setCurrentReport(null);
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
      fetchReport(ticker, currentReport?.horizon);
    }
  };

  const handleHorizonChange = (horizon: ForecastHorizon) => {
    if (ticker) {
      fetchReport(ticker, horizon);
    }
  };

  const handleRetry = () => {
    if (ticker) {
      fetchReport(ticker);
    }
  };

  // Show empty state when no ticker is searched
  if (!ticker && !isLoading && !currentReport) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-background">
        <EmptyState
          icon={<Search className="w-16 h-16" />}
          message="Search for a stock to view sentiment analysis"
          description="Enter a stock ticker in the search bar above to generate an AI-powered sentiment report with forecasts and risk analysis."
        />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ErrorMessage message={error} onRetry={ticker ? handleRetry : undefined} />
        </div>
      </div>
    );
  }

  // Show report or loading state
  return (
    <SentimentReport
      report={currentReport}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onHorizonChange={handleHorizonChange}
    />
  );
};

export default SentimentContainer;

