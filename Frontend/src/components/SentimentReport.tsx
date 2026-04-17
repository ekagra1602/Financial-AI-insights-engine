import { useState, useEffect } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { SentimentReport as SentimentReportType, ForecastHorizon, Stance } from '../types';
import { ReportSkeleton } from './SkeletonLoader';
import LoadingSpinner from './LoadingSpinner';

interface SentimentReportProps {
  report: SentimentReportType | null;
  isLoading: boolean;
  onRefresh: () => void;
  onHorizonChange: (horizon: ForecastHorizon) => void;
}

const SentimentReport = ({
  report,
  isLoading,
  onRefresh,
  onHorizonChange,
}: SentimentReportProps) => {
  const horizons: ForecastHorizon[] = ['1D', '1W', '1M', '3M', '6M'];
  const [selectedHorizon, setSelectedHorizon] = useState<ForecastHorizon>('1M');

  // Sync selected horizon button with the report that was actually fetched.
  // Prevents the highlighted button being out of sync when a new ticker is searched.
  useEffect(() => {
    if (report?.horizon) {
      setSelectedHorizon(report.horizon as ForecastHorizon);
    }
  }, [report?.ticker]);

  const handleHorizonChange = (horizon: ForecastHorizon) => {
    setSelectedHorizon(horizon);
    onHorizonChange(horizon);
  };

  const getStanceIcon = (stance?: Stance) => {
    if (stance === 'bullish') return <TrendingUp className="w-6 h-6" />;
    if (stance === 'bearish') return <TrendingDown className="w-6 h-6" />;
    return <Minus className="w-6 h-6" />;
  };

  const getStanceColor = (stance?: Stance) => {
    if (stance === 'bullish') return 'text-positive';
    if (stance === 'bearish') return 'text-negative';
    return 'text-text-secondary';
  };

  const getStanceBgColor = (stance?: Stance) => {
    if (stance === 'bullish') return 'bg-positive/10';
    if (stance === 'bearish') return 'bg-negative/10';
    return 'bg-surface-light';
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'border-negative text-negative bg-negative/10';
      case 'medium': return 'border-yellow-500 text-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-blue-500 text-blue-500 bg-blue-500/10';
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <ReportSkeleton />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading report..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* Header Actions */}
        <div className="flex justify-end mb-6">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:border-primary transition-colors text-text-primary"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Report</span>
          </button>
        </div>

        {/* Report Header */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {report.companyName}
              </h1>
              <div className="flex items-center gap-3 text-text-secondary">
                <span className="font-mono text-lg">{report.ticker}</span>
                <span>•</span>
                <span className="text-sm">Generated {formatDate(report.generatedAt)}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${getStanceBgColor(report.narrative?.stance)}`}>
              <div className={getStanceColor(report.narrative?.stance)}>
                {getStanceIcon(report.narrative?.stance)}
              </div>
              <span className={`font-semibold capitalize ${getStanceColor(report.narrative?.stance)}`}>
                {report.narrative?.stance || 'Neutral'}
              </span>
            </div>
          </div>

          {/* Horizon Selector */}
          <div className="mt-6 pt-6 border-t border-border">
            <label className="block text-text-secondary text-sm mb-3">Forecast Horizon</label>
            <div className="flex flex-wrap gap-2">
              {horizons.map((horizon) => (
                <button
                  key={horizon}
                  onClick={() => handleHorizonChange(horizon)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedHorizon === horizon
                      ? 'bg-primary text-background'
                      : 'bg-background border border-border text-text-primary hover:border-primary'
                  }`}
                >
                  {horizon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

          {/* Sentiment Score */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-text-secondary text-sm font-medium mb-3">Sentiment Score</h3>
            <div className="text-3xl font-bold text-text-primary mb-1">
              {(report.forecast.sentimentScore ?? 0).toFixed(1)}
              <span className="text-lg font-normal text-text-secondary">/100</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 mt-3">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${report.forecast.sentimentScore ?? 0}%` }}
              />
            </div>
            <p className="text-text-secondary text-xs mt-2">Fundamental & news signal</p>
          </div>

          {/* Expected Return */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-text-secondary text-sm font-medium mb-3">Expected Return</h3>
            <div className={`text-3xl font-bold mb-1 ${(report.forecast.expectedReturn ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
              {(report.forecast.expectedReturn ?? 0) >= 0 ? '+' : ''}
              {(report.forecast.expectedReturn ?? 0).toFixed(2)}%
            </div>
            <p className="text-text-secondary text-xs mt-2">Over selected horizon</p>
          </div>

          {/* Confidence Score */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-text-secondary text-sm font-medium mb-3">Model Confidence</h3>
            <div className="text-3xl font-bold text-text-primary mb-1">
              {Math.round(report.risk.confidenceScore ?? 0)}%
            </div>
            <div className="w-full bg-background rounded-full h-2 mt-3">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${report.risk.confidenceScore ?? 0}%` }}
              />
            </div>
            <p className="text-text-secondary text-xs mt-2">LLM analysis confidence</p>
          </div>
        </div>

        {/* Forecast Range */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Forecast Range
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Pessimistic (10th percentile)', value: report.forecast.quantiles?.q10 ?? 0 },
              { label: 'Expected (50th percentile)',    value: report.forecast.quantiles?.q50 ?? 0 },
              { label: 'Optimistic (90th percentile)',  value: report.forecast.quantiles?.q90 ?? 0 },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-secondary text-sm">{label}</span>
                  <span className={`font-bold ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${value >= 0 ? 'bg-positive' : 'bg-negative'}`}
                    style={{ width: `${Math.min(Math.abs(value) * 5, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Summary */}
        {report.narrative && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-text-primary mb-4">Analysis Summary</h2>
            <div className={`p-6 rounded-lg ${getStanceBgColor(report.narrative.stance)}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={getStanceColor(report.narrative.stance)}>
                  {getStanceIcon(report.narrative.stance)}
                </div>
                <span className={`text-xl font-bold capitalize ${getStanceColor(report.narrative.stance)}`}>
                  {report.narrative.stance} Outlook
                </span>
              </div>
              <p className="text-text-primary leading-relaxed">{report.narrative.explanation}</p>
            </div>
          </div>
        )}

        {/* Top Influencing Factors */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Top Influencing Factors</h2>
          {report.risk.topDrivers.length > 0 ? (
            <div className="space-y-3">
              {report.risk.topDrivers.map((driver) => (
                <div key={driver.id} className="p-4 bg-background rounded-lg">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">{driver.factor}</h3>
                      <p className="text-text-secondary text-sm">{driver.description}</p>
                    </div>
                    <div className={`text-lg font-bold flex-shrink-0 ${driver.impact >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {driver.impact >= 0 ? '+' : ''}{(driver.impact * 100).toFixed(0)}
                    </div>
                  </div>
                  <div className="w-full bg-surface-light rounded-full h-2 mt-3">
                    <div
                      className={`h-2 rounded-full ${driver.impact >= 0 ? 'bg-positive' : 'bg-negative'}`}
                      style={{ width: `${Math.min(Math.abs(driver.impact) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">
              No key drivers identified for this analysis
            </div>
          )}
        </div>

        {/* Risk Flags */}
        {report.risk.flags.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Risk Flags
            </h2>
            <div className="space-y-3">
              {report.risk.flags.map((flag) => (
                <div key={flag.id} className={`p-4 rounded-lg border ${getSeverityColor(flag.severity)}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold capitalize mb-1">{flag.severity} Risk</div>
                      <div className="text-sm opacity-90">{flag.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SentimentReport;
