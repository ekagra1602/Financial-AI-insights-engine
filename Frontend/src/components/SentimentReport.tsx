import { useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Target,
  BarChart3,
  Info,
} from 'lucide-react';
import { SentimentReport as SentimentReportType, ForecastHorizon, Stance } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { ReportSkeleton } from './SkeletonLoader';

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

  const handleHorizonChange = (horizon: ForecastHorizon) => {
    setSelectedHorizon(horizon);
    onHorizonChange(horizon);
  };

  const getStanceIcon = (stance?: Stance) => {
    if (!stance) return <Minus className="w-6 h-6" />;
    if (stance === 'bullish') return <TrendingUp className="w-6 h-6" />;
    if (stance === 'bearish') return <TrendingDown className="w-6 h-6" />;
    return <Minus className="w-6 h-6" />;
  };

  const getStanceColor = (stance?: Stance) => {
    if (!stance) return 'text-text-secondary';
    if (stance === 'bullish') return 'text-positive';
    if (stance === 'bearish') return 'text-negative';
    return 'text-text-secondary';
  };

  const getStanceBgColor = (stance?: Stance) => {
    if (!stance) return 'bg-surface-light';
    if (stance === 'bullish') return 'bg-positive/10';
    if (stance === 'bearish') return 'bg-negative/10';
    return 'bg-surface-light';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return 'border-negative text-negative bg-negative/10';
      case 'medium':
        return 'border-yellow-500 text-yellow-500 bg-yellow-500/10';
      case 'low':
        return 'border-blue-500 text-blue-500 bg-blue-500/10';
    }
  };

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
                <span className="text-sm">Updated {formatDate(report.generatedAt)}</span>
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

        {/* Forecast Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-text-secondary text-sm font-medium">Probability Up</h3>
              <Target className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="text-3xl font-bold text-text-primary mb-2">
              {report.forecast.probabilityUp.toFixed(1)}%
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${report.forecast.probabilityUp}%` }}
              />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-text-secondary text-sm font-medium">Expected Return</h3>
              <TrendingUp className="w-5 h-5 text-text-secondary" />
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                report.forecast.expectedReturn >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {report.forecast.expectedReturn >= 0 ? '+' : ''}
              {report.forecast.expectedReturn.toFixed(2)}%
            </div>
            <div className="text-text-secondary text-sm">Over selected horizon</div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-text-secondary text-sm font-medium">Confidence Score</h3>
              <BarChart3 className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="text-3xl font-bold text-text-primary mb-2">
              {report.risk.confidenceScore.toFixed(1)}%
            </div>
            <div className="text-text-secondary text-sm">Model confidence level</div>
          </div>
        </div>

        {/* Forecast Quantiles */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Forecast Range
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary text-sm">Pessimistic (10th percentile)</span>
                <span
                  className={`font-bold ${
                    report.forecast.quantiles.q10 >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {report.forecast.quantiles.q10 >= 0 ? '+' : ''}
                  {report.forecast.quantiles.q10.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    report.forecast.quantiles.q10 >= 0 ? 'bg-positive' : 'bg-negative'
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(report.forecast.quantiles.q10) * 5, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary text-sm">Expected (50th percentile)</span>
                <span
                  className={`font-bold ${
                    report.forecast.quantiles.q50 >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {report.forecast.quantiles.q50 >= 0 ? '+' : ''}
                  {report.forecast.quantiles.q50.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    report.forecast.quantiles.q50 >= 0 ? 'bg-positive' : 'bg-negative'
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(report.forecast.quantiles.q50) * 5, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary text-sm">Optimistic (90th percentile)</span>
                <span
                  className={`font-bold ${
                    report.forecast.quantiles.q90 >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {report.forecast.quantiles.q90 >= 0 ? '+' : ''}
                  {report.forecast.quantiles.q90.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    report.forecast.quantiles.q90 >= 0 ? 'bg-positive' : 'bg-negative'
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(report.forecast.quantiles.q90) * 5, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-background rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-text-secondary mt-0.5 flex-shrink-0" />
                <p className="text-text-secondary text-sm">
                  Uncertainty: {report.forecast.uncertainty.toFixed(1)}% - This represents the
                  model's level of certainty in the forecast.
                </p>
              </div>
            </div>
          </div>
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
                <div
                  key={flag.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(flag.severity)}`}
                >
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

        {/* Top Drivers */}
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className={`text-lg font-bold ${
                          driver.impact >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {driver.impact >= 0 ? '+' : ''}
                        {(driver.impact * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-surface-light rounded-full h-2 mt-3">
                    <div
                      className={`h-2 rounded-full ${
                        driver.impact >= 0 ? 'bg-positive' : 'bg-negative'
                      }`}
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

        {/* Narrative */}
        {report.narrative && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-text-primary mb-4">Analysis Summary</h2>
            <div className={`p-6 rounded-lg ${getStanceBgColor(report.narrative.stance)}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={getStanceColor(report.narrative.stance)}>
                  {getStanceIcon(report.narrative.stance)}
                </div>
                <span
                  className={`text-xl font-bold capitalize ${getStanceColor(
                    report.narrative.stance
                  )}`}
                >
                  {report.narrative.stance} Outlook
                </span>
              </div>
              <p className="text-text-primary leading-relaxed">{report.narrative.explanation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SentimentReport;

