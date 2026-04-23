import { http, HttpResponse } from 'msw';

export const SAMPLE_REPORT = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  horizon: '1M',
  generatedAt: '2026-04-23T00:00:00+00:00',
  forecast: {
    sentimentScore: 72.5,
    expectedReturn: 3.38,
    quantiles: { q10: -5.0, q50: 3.38, q90: 11.76 },
  },
  risk: {
    flags: [{ id: 'f1', severity: 'low', message: 'Elevated PE ratio' }],
    topDrivers: [
      { id: 'd1', factor: 'Revenue Growth', impact: 0.35, description: 'Strong QoQ growth' },
    ],
    confidenceScore: 78,
  },
  narrative: {
    stance: 'bullish',
    explanation: 'Apple shows strong fundamentals.',
  },
};

export const handlers = [
  http.get('http://localhost:8000/api/v1/sentiment/report/:ticker', ({ request }) => {
    const url = new URL(request.url);
    const horizon = url.searchParams.get('horizon') ?? '1M';
    return HttpResponse.json({ ...SAMPLE_REPORT, horizon });
  }),

  http.post('http://localhost:8000/api/v1/sentiment/ingest/:ticker', ({ params }) => {
    return HttpResponse.json({ ticker: params.ticker, status: 'ok', upserted: 4 });
  }),

  http.get('http://localhost:8000/api/v1/watchlist', () => {
    return HttpResponse.json([
      { symbol: 'AAPL', name: 'Apple Inc.', price: 185.5, change: 1.2, news_notify_count: 0 },
    ]);
  }),

  http.get('http://localhost:8000/api/v1/reminders', () => {
    return HttpResponse.json([]);
  }),

  http.get('http://localhost:8000/api/v1/alerts', () => {
    return HttpResponse.json([]);
  }),

  http.get('http://localhost:8000/api/v1/notifications', () => {
    return HttpResponse.json([]);
  }),
];
