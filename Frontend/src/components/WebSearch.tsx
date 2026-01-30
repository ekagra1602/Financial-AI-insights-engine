import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  stockWatchlist,
  newsArticles,
  dailyMovers,
  stockNewsArticles,
} from '../data/demoData';

type Mode = 'stocks' | 'news' | 'both' | 'web';

interface StockResult {
  symbol: string;
  name?: string;
  price: number;
  changePercent: number;
}

interface NewsResult {
  id: string;
  source: string;
  timeAgo: string;
  title: string;
  ticker?: string;
  excerpt?: string;
}

const RECENT_KEY = 'q_recent_searches_v1';

const isTickerLike = (q: string) => /^[A-Za-z]{1,5}$/.test(q.trim());

const saveRecent = (q: string) => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) as string[] : [];
    const dedup = [q, ...arr.filter((x) => x !== q)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(dedup));
  } catch (e) {
    // ignore
  }
};

const loadRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (e) {
    return [];
  }
};

const WebSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mode] = useState<Mode>('both');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [resultsStocks, setResultsStocks] = useState<StockResult[]>([]);
  const [resultsNews, setResultsNews] = useState<NewsResult[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [sentiment, setSentiment] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [eli5, setEli5] = useState(false);
  // no local ref needed currently



  // fetch wiki suggestions + stock symbol suggestions
  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }

    const tickerMatches = stockWatchlist
      .filter((s) => s.symbol.toLowerCase().startsWith(q.toLowerCase()) || (s.name || '').toLowerCase().includes(q.toLowerCase()))
      .slice(0, 5)
      .map((s) => s.symbol + (s.name ? ` — ${s.name}` : ''));

    // Wikipedia suggestions (best-effort)
    try {
      const resp = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${encodeURIComponent(q)}&limit=6`,
      );
      const data = await resp.json();
      const wiki = Array.isArray(data[1]) ? data[1] : [];
      setSuggestions([...tickerMatches, ...wiki]);
    } catch (e) {
      setSuggestions(tickerMatches);
    }
  };

  const doSearch = async (qIn?: string) => {
    const q = (qIn ?? query).trim();
    if (!q) return;
    setLoading(true);
    setSuggestions([]);
    saveRecent(q);
    setRecent(loadRecent());

    // mode detection override
    let detectedMode: Mode = mode;
    if (isTickerLike(q)) detectedMode = 'stocks';

    // Stocks
    const stocks: StockResult[] = [];
    if (detectedMode === 'stocks' || detectedMode === 'both') {
      const symbol = q.toUpperCase();
      const bySymbol = stockWatchlist.filter((s) => s.symbol === symbol);
      if (bySymbol.length) {
        bySymbol.forEach((s) => stocks.push({ symbol: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent }));
      } else {
        stockWatchlist.forEach((s) => {
          if ((s.name || '').toLowerCase().includes(q.toLowerCase()) || s.symbol.toLowerCase().includes(q.toLowerCase())) {
            stocks.push({ symbol: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent });
          }
        });
      }
    }

    // News
    const news: NewsResult[] = [];
    if (detectedMode === 'news' || detectedMode === 'both' || detectedMode === 'web') {
      newsArticles.forEach((n) => {
        const nt = ((n as any).ticker || '').toString().toLowerCase();
        if (n.title.toLowerCase().includes(q.toLowerCase()) || nt === q.toLowerCase()) {
          news.push(n as NewsResult);
        }
      });

      // include stockNewsArticles as well
      stockNewsArticles.forEach((n) => {
        const nt = ((n as any).ticker || '').toString().toLowerCase();
        if (n.title.toLowerCase().includes(q.toLowerCase()) || nt === q.toLowerCase()) {
          news.push(n as NewsResult);
        }
      });
    }

    // If no direct results, attempt Wikipedia summary fallback for web mode
    if (detectedMode === 'web' && news.length === 0 && stocks.length === 0) {
      try {
        const resp = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${encodeURIComponent(q)}&limit=6`,
        );
        const data = await resp.json();
        const titles: string[] = Array.isArray(data[1]) ? data[1] : [];
        if (titles.length) {
          // fetch summary for first
          const sumResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0])}`);
          if (sumResp.ok) {
            const json = await sumResp.json();
            news.push({ id: 'wiki', source: 'Wikipedia', timeAgo: '', title: titles[0], excerpt: json.extract });
          }
        }
      } catch {
        // ignore
      }
    }

    setResultsStocks(stocks);
    setResultsNews(news);
    setLoading(false);
    // show overlay with results
    setShowOverlay(true);
  };

  const onSuggestionClick = (s: string) => {
    const clean = s.split(' — ')[0];
    setQuery(clean);
    doSearch(clean);
  };

  // quick trending topics generated from demo data
  const trending = [
    { title: 'Fed Rate Decisions', count: 24, sentiment: 'neutral' },
    { title: 'EV Market Shifts', count: 18, sentiment: 'positive' },
    { title: 'AI Chip Shortage', count: 13, sentiment: 'negative' },
  ];

  const industryCards = [
    { name: 'Technology', companies: ['AAPL', 'NVDA', 'MSFT'] },
    { name: 'Healthcare', companies: ['Haemonetics'] },
    { name: 'Energy', companies: ['Backblaze'] },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: main content */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-surface rounded-xl p-6">
              {/* Smart search bar */}
              {/* Hero search */}
              <div className="flex flex-col items-center text-center gap-4 mb-6">
                <h2 className="text-2xl md:text-3xl font-semibold text-text-primary">Search the market, news, and web</h2>
                <p className="text-text-secondary max-w-2xl">Find stocks, read AI-summaries of articles, explore trending topics, or ask general finance questions.</p>

                <div className="w-full md:w-3/4 relative mt-4">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-text-secondary" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      fetchSuggestions(e.target.value);
                    }}
                    placeholder="Search stocks (AAPL), topics (AI chips), or ask: 'What's driving tech stocks today?'"
                    className="w-full bg-background border border-border rounded-full pl-16 pr-36 py-4 text-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary shadow-sm"
                  />

                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <button onClick={() => doSearch()} className="px-5 py-2 bg-primary text-black rounded-full font-medium shadow">Search</button>
                  </div>

                  {/* suggestions dropdown */}
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-3 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-2 text-text-secondary text-sm">Suggestions</div>
                      <div className="divide-y divide-border">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => onSuggestionClick(s)}
                            className="w-full text-left px-4 py-3 hover:bg-surface-light transition text-text-primary"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* recent chips */}
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {recent.slice(0,8).map((r, i) => (
                    <button key={i} onClick={() => doSearch(r)} className="px-3 py-1 bg-background border border-border rounded-full text-sm text-text-primary hover:shadow">{r}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Trending / Discovery */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-surface rounded-xl p-4">
                <h3 className="text-lg font-semibold text-text-primary mb-3">Trending Topics</h3>
                <div className="space-y-2">
                  {trending.map((t, i) => (
                    <button key={i} onClick={() => doSearch(t.title)} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded hover:shadow">
                      <div>
                        <div className="font-medium text-text-primary">{t.title}</div>
                        <div className="text-text-secondary text-sm">{t.count} related articles</div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${t.sentiment === 'positive' ? 'bg-positive' : t.sentiment === 'negative' ? 'bg-negative' : 'bg-surface-light'}`}>{t.sentiment}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-xl p-4">
                <h3 className="text-lg font-semibold text-text-primary mb-3">Hot Industries</h3>
                <div className="grid grid-cols-2 gap-3">
                  {industryCards.map((c, i) => (
                    <div key={i} className="p-3 bg-background border border-border rounded hover:shadow cursor-pointer" onClick={() => doSearch(c.name)}>
                      <div className="font-medium text-text-primary">{c.name}</div>
                      <div className="text-text-secondary text-sm">Top: {c.companies.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-xl p-4">
                <h3 className="text-lg font-semibold text-text-primary mb-3">Market Movers</h3>
                <div className="space-y-2">
                  {dailyMovers.slice(0,5).map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-background border border-border rounded">
                      <div>
                        <div className="font-medium text-text-primary">{m.symbol}</div>
                        <div className="text-text-secondary text-sm">{m.name}</div>
                      </div>
                      <div className={`font-medium ${m.changePercent >= 0 ? 'text-positive' : 'text-negative'}`}>{m.changePercent.toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Results are shown in an overlay when a search is performed. */}
          </div>

          {/* Right column: advanced filters */}
          <div className="lg:col-span-1">
            <div className="bg-surface rounded-xl p-4 sticky top-24">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-text-primary">Filters</h4>
                <button onClick={() => setShowFilters((s) => !s)} className="text-text-secondary">{showFilters ? 'Hide' : 'Show'}</button>
              </div>

              {showFilters && (
                <div className="space-y-3">
                  <div>
                    <div className="text-text-secondary text-sm mb-1">Time range</div>
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="w-full bg-background border border-border rounded p-2 text-text-primary">
                      <option value="1d">Today</option>
                      <option value="7d">This week</option>
                      <option value="30d">This month</option>
                      <option value="90d">3 months</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-text-secondary text-sm mb-1">Sentiment</div>
                    <div className="flex gap-2">
                      <button onClick={() => setSentiment('all')} className={`px-2 py-1 rounded ${sentiment === 'all' ? 'bg-surface-light' : ''}`}>All</button>
                      <button onClick={() => setSentiment('positive')} className={`px-2 py-1 rounded ${sentiment === 'positive' ? 'bg-surface-light' : ''}`}>Positive</button>
                      <button onClick={() => setSentiment('neutral')} className={`px-2 py-1 rounded ${sentiment === 'neutral' ? 'bg-surface-light' : ''}`}>Neutral</button>
                      <button onClick={() => setSentiment('negative')} className={`px-2 py-1 rounded ${sentiment === 'negative' ? 'bg-surface-light' : ''}`}>Negative</button>
                    </div>
                  </div>

                  <div>
                    <div className="text-text-secondary text-sm mb-1">Explain style</div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={eli5} onChange={(e) => setEli5(e.target.checked)} />
                      <span className="text-text-secondary text-sm">Explain like I'm 5</span>
                    </label>
                  </div>

                  <div>
                    <div className="text-text-secondary text-sm mb-1">Sort by</div>
                    <select className="w-full bg-background border border-border rounded p-2 text-text-primary">
                      <option>Relevance</option>
                      <option>Date</option>
                      <option>Sentiment</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Results overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOverlay(false)} />

          <div className="relative z-60 w-full max-w-4xl mx-4">
            <div className="bg-surface rounded-xl p-6 shadow-xl max-h-[80vh] overflow-auto border border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-text-secondary">Search results</div>
                  <div className="text-lg font-semibold text-text-primary">{query || 'Results'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank'); }} className="px-3 py-1 bg-background border border-border rounded text-text-primary text-sm">Open full results</button>
                  <button onClick={() => setShowOverlay(false)} className="px-3 py-1 bg-background border border-border rounded text-text-primary text-sm">Close</button>
                </div>
              </div>

              {loading ? (
                <div className="text-text-secondary">Searching…</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-text-primary font-medium mb-2">Stocks</h4>
                    {resultsStocks.length === 0 ? (
                      <div className="text-text-secondary">No matching stocks.</div>
                    ) : (
                      <div className="space-y-2">
                        {resultsStocks.map((s) => (
                          <div key={s.symbol} className="p-3 bg-background border border-border rounded flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-text-primary">{s.symbol} {s.name ? <span className="text-text-secondary text-sm ml-2">{s.name}</span> : null}</div>
                              <div className="text-text-secondary text-sm">Price: ${s.price.toFixed(2)}</div>
                            </div>
                            <div className={`font-medium ${s.changePercent >= 0 ? 'text-positive' : 'text-negative'}`}>{s.changePercent.toFixed(2)}%</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-text-primary font-medium mb-2">News</h4>
                    {resultsNews.length === 0 ? (
                      <div className="text-text-secondary">No news results found.</div>
                    ) : (
                      <div className="space-y-3">
                        {resultsNews.map((n) => (
                          <div key={n.id} className="p-3 bg-background border border-border rounded">
                            <div className="text-sm text-text-secondary">{n.source} · {n.timeAgo}</div>
                            <div className="font-semibold text-text-primary">{n.title}</div>
                            <div className="text-text-secondary text-sm mt-2">{n.excerpt ? n.excerpt : 'Summary not available'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSearch;
