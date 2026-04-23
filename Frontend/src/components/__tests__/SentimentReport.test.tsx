import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SentimentReport from '../SentimentReport';
import { SAMPLE_REPORT } from '../../__tests__/mocks/handlers';
import type { SentimentReport as SentimentReportType, ForecastHorizon } from '../../types';

const report = SAMPLE_REPORT as unknown as SentimentReportType;

const defaultProps = {
  report,
  isLoading: false,
  onRefresh: vi.fn(),
  onHorizonChange: vi.fn(),
};

describe('SentimentReport rendering', () => {
  it('renders skeleton (animate-pulse divs) when isLoading=true and report=null', () => {
    render(<SentimentReport {...defaultProps} report={null} isLoading={true} />);
    const pulseEls = document.querySelectorAll('.animate-pulse');
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it('renders loading spinner text when report=null and isLoading=false', () => {
    render(<SentimentReport {...defaultProps} report={null} isLoading={false} />);
    expect(screen.getByText('Loading report...')).toBeInTheDocument();
  });

  it("renders company name 'Apple Inc.' and ticker 'AAPL'", () => {
    render(<SentimentReport {...defaultProps} />);
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders bullish stance with text-positive class in the header badge', () => {
    render(<SentimentReport {...defaultProps} />);
    // 'bullish' appears in the header badge span AND in "bullish Outlook" — get the exact badge span
    const bullishSpans = getAllByTextExact(document.body, /^bullish$/i, 'SPAN');
    expect(bullishSpans.length).toBeGreaterThan(0);
    expect(bullishSpans[0]).toHaveClass('text-positive');
  });

  it('renders bearish stance with text-negative class in the header badge', () => {
    const bearishReport: SentimentReportType = {
      ...report,
      narrative: { ...report.narrative, stance: 'bearish' },
    };
    render(<SentimentReport {...defaultProps} report={bearishReport} />);
    const bearishSpans = getAllByTextExact(document.body, /^bearish$/i, 'SPAN');
    expect(bearishSpans.length).toBeGreaterThan(0);
    expect(bearishSpans[0]).toHaveClass('text-negative');
  });

  it('renders neutral stance with text-text-secondary class in the header badge', () => {
    const neutralReport: SentimentReportType = {
      ...report,
      narrative: { ...report.narrative, stance: 'neutral' },
    };
    render(<SentimentReport {...defaultProps} report={neutralReport} />);
    const neutralSpans = getAllByTextExact(document.body, /^neutral$/i, 'SPAN');
    expect(neutralSpans.length).toBeGreaterThan(0);
    expect(neutralSpans[0]).toHaveClass('text-text-secondary');
  });

  it('renders sentiment score showing 72.5 and /100', () => {
    render(<SentimentReport {...defaultProps} />);
    expect(screen.getByText('72.5')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it("renders positive expected return '+3.38%' with text-positive class", () => {
    render(<SentimentReport {...defaultProps} />);
    // '+3.38%' appears in both the Expected Return card (div.text-3xl) and the
    // Forecast Range q50 row (span.font-bold). Target the large card value.
    const returnEls = screen.getAllByText('+3.38%');
    const cardEl = returnEls.find((el) => el.classList.contains('text-3xl'));
    expect(cardEl).toBeDefined();
    expect(cardEl).toHaveClass('text-positive');
  });

  it('renders negative expected return with text-negative class', () => {
    const negReport: SentimentReportType = {
      ...report,
      forecast: { ...report.forecast, expectedReturn: -2.5 },
    };
    render(<SentimentReport {...defaultProps} report={negReport} />);
    const returnEl = screen.getByText(/-2\.50%/);
    expect(returnEl).toHaveClass('text-negative');
  });

  it('renders three quantile rows for forecast range', () => {
    render(<SentimentReport {...defaultProps} />);
    expect(screen.getByText(/Pessimistic \(10th percentile\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected \(50th percentile\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimistic \(90th percentile\)/i)).toBeInTheDocument();
  });

  it('renders confidence score of 78%', () => {
    render(<SentimentReport {...defaultProps} />);
    // confidence score is rendered as Math.round(78) = "78" followed by "%"
    // It appears as "78%" inside the Model Confidence card
    const confidenceEl = screen.getByText('78%');
    expect(confidenceEl).toBeInTheDocument();
  });
});

describe('SentimentReport interactions', () => {
  it('renders all five horizon buttons (1D, 1W, 1M, 3M, 6M)', () => {
    render(<SentimentReport {...defaultProps} />);
    for (const label of ['1D', '1W', '1M', '3M', '6M']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('1M button is selected by default (has bg-primary class)', () => {
    render(<SentimentReport {...defaultProps} />);
    const btn1M = screen.getByRole('button', { name: '1M' });
    expect(btn1M).toHaveClass('bg-primary');
  });

  it("clicking 1W button calls onHorizonChange with '1W'", () => {
    const onHorizonChange = vi.fn();
    render(<SentimentReport {...defaultProps} onHorizonChange={onHorizonChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1W' }));
    expect(onHorizonChange).toHaveBeenCalledWith('1W' as ForecastHorizon);
  });

  it('selected horizon syncs when report.ticker changes (rerender with TSLA + horizon 1W)', () => {
    const { rerender } = render(<SentimentReport {...defaultProps} />);
    // Initially 1M is selected (matches report.horizon)
    expect(screen.getByRole('button', { name: '1M' })).toHaveClass('bg-primary');

    const tslaReport: SentimentReportType = {
      ...report,
      ticker: 'TSLA',
      companyName: 'Tesla Inc.',
      horizon: '1W',
    };
    rerender(<SentimentReport {...defaultProps} report={tslaReport} />);
    expect(screen.getByRole('button', { name: '1W' })).toHaveClass('bg-primary');
  });

  it("clicking 'Refresh Report' button calls onRefresh once", () => {
    const onRefresh = vi.fn();
    render(<SentimentReport {...defaultProps} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh report/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders top driver card: 'Revenue Growth' and 'Strong QoQ growth'", () => {
    render(<SentimentReport {...defaultProps} />);
    expect(screen.getByText('Revenue Growth')).toBeInTheDocument();
    expect(screen.getByText('Strong QoQ growth')).toBeInTheDocument();
  });

  it('renders risk flag with border-negative for high severity', () => {
    const highRiskReport: SentimentReportType = {
      ...report,
      risk: {
        ...report.risk,
        flags: [{ id: 'f2', severity: 'high', message: 'Very high debt' }],
      },
    };
    render(<SentimentReport {...defaultProps} report={highRiskReport} />);
    const flagMsg = screen.getByText('Very high debt');
    const flagCard = flagMsg.closest('[class*="border"]');
    expect(flagCard).toHaveClass('border-negative');
  });
});

// ---------------------------------------------------------------------------
// Helper: collect all elements of a given tag whose trimmed text matches regex
// ---------------------------------------------------------------------------
function getAllByTextExact(
  container: HTMLElement,
  pattern: RegExp,
  tagName: string,
): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(tagName)).filter(
    (el) => pattern.test(el.textContent?.trim() ?? ''),
  );
}
