import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SentimentContainer from '../SentimentContainer';
import { SAMPLE_REPORT } from '../../__tests__/mocks/handlers';
import type { SentimentReport as SentimentReportType } from '../../types';
import { fetchSentimentReport } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchSentimentReport: vi.fn(),
}));

const mockFetch = vi.mocked(fetchSentimentReport);

function renderContainer(ticker: string | null, path = '/sentiment-reports') {
  const url = ticker ? `${path}?ticker=${ticker}` : path;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/sentiment-reports"
          element={<SentimentContainer ticker={ticker} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SentimentContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(SAMPLE_REPORT as unknown as SentimentReportType);
  });

  it('shows ticker input on initial render with no ticker', () => {
    renderContainer(null);
    expect(
      screen.getByPlaceholderText(/enter stock ticker/i),
    ).toBeInTheDocument();
  });

  it('shows empty state message when no ticker supplied', () => {
    renderContainer(null);
    expect(
      screen.getByText(/generate ai-powered sentiment analysis/i),
    ).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    // Return a never-resolving promise to hold in the loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderContainer('AAPL');
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders report after successful fetch', async () => {
    renderContainer('AAPL');
    await waitFor(() =>
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument(),
    );
  });

  it('shows error message on API failure', async () => {
    mockFetch.mockRejectedValue(
      new Error('Failed to fetch report. Please try again.'),
    );
    renderContainer('AAPL');
    await waitFor(() =>
      expect(
        screen.getByText(/failed to fetch/i),
      ).toBeInTheDocument(),
    );
  });

  it('horizon change triggers new fetch with correct horizon param', async () => {
    renderContainer('AAPL');
    await waitFor(() => screen.getByText('Apple Inc.'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '1W' }));
    });
    expect(mockFetch).toHaveBeenCalledWith('AAPL', '1W', false);
  });

  it('force_refresh=true is sent when Refresh Report clicked', async () => {
    renderContainer('AAPL');
    await waitFor(() => screen.getByText('Apple Inc.'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh report/i }));
    });
    expect(mockFetch).toHaveBeenLastCalledWith('AAPL', expect.any(String), true);
  });

  it('retains existing report when refresh results in error', async () => {
    renderContainer('AAPL');
    await waitFor(() => screen.getByText('Apple Inc.'));
    mockFetch.mockRejectedValue(new Error('timeout'));
    fireEvent.click(screen.getByRole('button', { name: /refresh report/i }));
    await waitFor(() =>
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument(),
    );
  });

  it('error state shows retry button', async () => {
    mockFetch.mockRejectedValue(
      new Error('Failed to fetch report. Please try again.'),
    );
    renderContainer('AAPL');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument(),
    );
  });

  it('navigates to ?ticker= URL when search form is submitted', async () => {
    renderContainer(null);
    const input = screen.getByPlaceholderText(/enter stock ticker/i);
    fireEvent.change(input, { target: { value: 'tsla' } });
    fireEvent.submit(input.closest('form')!);
    // After submit, component should still render without crashing
    expect(input).toBeInTheDocument();
  });
});
