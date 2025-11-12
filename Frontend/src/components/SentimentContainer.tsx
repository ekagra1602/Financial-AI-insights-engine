import React, { useState, useEffect } from 'react';
import SentimentHome from './SentimentHome';
import SentimentReport from './SentimentReport';
import ErrorMessage from './ErrorMessage';
import { SentimentReport as SentimentReportType, ForecastHorizon } from '../types';
import { demoReports } from '../data/sentimentData';

type View = 'home' | 'report';

const SentimentContainer: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<SentimentReportType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate fetching a report
  const fetchReport = async (ticker: string, horizon: ForecastHorizon = '1M') => {
    setIsLoading(true);
    setError(null);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // In a real app, this would be an API call
      const report = demoReports[ticker];
      
      if (report) {
        // Update the horizon in the report
        setCurrentReport({ ...report, horizon });
        setCurrentView('report');
      } else {
        // If ticker not found in demo data, show error
        setError(`No report available for ${ticker}. Try AAPL, GOOGL, or MSFT.`);
      }
    } catch (err) {
      setError('Failed to fetch report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (ticker: string) => {
    setCurrentTicker(ticker);
    fetchReport(ticker);
  };

  const handleBack = () => {
    setCurrentView('home');
    setCurrentReport(null);
    setError(null);
  };

  const handleRefresh = () => {
    if (currentTicker) {
      fetchReport(currentTicker, currentReport?.horizon);
    }
  };

  const handleHorizonChange = (horizon: ForecastHorizon) => {
    if (currentTicker) {
      fetchReport(currentTicker, horizon);
    }
  };

  const handleRetry = () => {
    if (currentTicker) {
      fetchReport(currentTicker);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ErrorMessage message={error} onRetry={currentTicker ? handleRetry : undefined} />
          <button
            onClick={handleBack}
            className="mt-6 w-full px-4 py-2 bg-surface border border-border rounded-lg hover:border-primary transition-colors text-text-primary"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'report' || isLoading) {
    return (
      <SentimentReport
        report={currentReport}
        isLoading={isLoading}
        onBack={handleBack}
        onRefresh={handleRefresh}
        onHorizonChange={handleHorizonChange}
      />
    );
  }

  return <SentimentHome onSearch={handleSearch} />;
};

export default SentimentContainer;

