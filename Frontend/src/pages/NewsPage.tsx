import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Filter } from 'lucide-react';

import { NewsCard } from '../components/news/NewsCard';
import { RelatedArticles } from '../components/news/RelatedArticles';
import { summarizedNewsArticles, relatedArticles } from '../data/newsData';
import { stockWatchlist } from '../data/demoData';
import { SummarizedNewsArticle, RelatedArticle, StockData } from '../types';
import { fetchCompanyNews, fetchMarketNews } from '../services/api';

// ... (imports)

// ... (helper functions)

// Define the type for route parameters
type NewsPageParams = {
  ticker?: string;
}

// Helper to format timestamp to "Xh ago"
const formatTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

export const NewsPage: React.FC = () => {
  const { ticker } = useParams<NewsPageParams>();
  const [newsArticles, setNewsArticles] = useState<SummarizedNewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRelatedOpen, setIsRelatedOpen] = useState<boolean>(false);
  const [currentRelatedArticles, setCurrentRelatedArticles] = useState<RelatedArticle[]>([]);
  const [relationTitle, setRelationTitle] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [watchlistStocks, setWatchlistStocks] = useState<StockData[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [availableTickers, setAvailableTickers] = useState<string[]>([]);

  // Initialize watchlist and available tickers
  useEffect(() => {
    const stocks = stockWatchlist;
    setWatchlistStocks(stocks);

    // Set available tickers (tickers that have news)
    const tickers = stocks.map(s => s.symbol);
    setAvailableTickers(tickers);

    // By default, DO NOT select all tickers. We want to show general news first.
    // Only if a specific ticker is in URL, we might want to select it (handled in fetch logic)
    setSelectedTickers([]);
  }, []);

  // Fetch news data based on selected tickers
  const fetchNewsArticles = async () => {
    setLoading(true);
    setError(null);

    // Simple way to avoid race conditions: clear articles immediately when fetching starts
    // setNewsArticles([]); // Optional: if you want to clear old news while loading new

    try {
      let articles: SummarizedNewsArticle[] = [];

      // If specific ticker is in URL, use that.
      if (ticker) {
        const newsList = await fetchCompanyNews(ticker);
        articles = mapNewsResponse(newsList, ticker);
      }
      // If tickers are selected in filter, fetch for them
      else if (selectedTickers.length > 0) {
        console.log("Fetching news for selected tickers:", selectedTickers);
        // We use map with internal try/catch to ensure one failure doesn't break all
        const promises = selectedTickers.map(async (t) => {
          try {
            const data = await fetchCompanyNews(t);
            return { status: 'fulfilled', value: data, ticker: t };
          } catch (e) {
            console.error(`Failed to fetch news for ${t}`, e);
            return { status: 'rejected', reason: e, ticker: t };
          }
        });

        const results = await Promise.all(promises);

        results.forEach((result: any) => {
          if (result.status === 'fulfilled') {
            const tick = result.ticker;
            articles.push(...mapNewsResponse(result.value, tick));
          }
        });
      }
      // If NO tickers selected, fetch general market news
      else {
        console.log("Fetching general market news");
        const newsList = await fetchMarketNews();
        // Market news might not have a specific ticker, or might have 'market'
        articles = mapNewsResponse(newsList, 'Market');
      }

      // Deduplicate articles based on URL
      const uniqueArticles: SummarizedNewsArticle[] = [];
      const seenUrls = new Set<string>();

      articles.forEach(article => {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          uniqueArticles.push(article);
        }
      });

      // Sort by recency
      uniqueArticles.sort((a: any, b: any) => b.rawDatetime - a.rawDatetime);

      if (uniqueArticles.length === 0) {
        // Only set error if we really have no articles and we expected some
        if (selectedTickers.length > 0 || ticker) {
          setError('No news articles available for selected companies.');
        } else {
          setError('No market news available.');
        }
      }

      setNewsArticles(uniqueArticles);
      setLastUpdated('Just now');

    } catch (err) {
      console.error(err);
      setError('Failed to load news articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const mapNewsResponse = (newsList: any[], tickerLabel: string): SummarizedNewsArticle[] => {
    return newsList.map((item: any, idx: number) => ({
      id: `${tickerLabel}-${item.datetime}-${idx}`,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      publishedTime: formatTimeAgo(item.datetime),
      sentiment: 'neutral' as const,
      tone: 'neutral' as const,
      keywords: [],
      ticker: tickerLabel,
      rawDatetime: item.datetime
    }));
  };

  // Generate related articles based on keywords
  const generateRelatedArticles = (articleId: string, keywords: string[]) => {
    // First check if we have predefined related articles
    const existingRelated = relatedArticles[articleId] || [];

    if (existingRelated.length > 0) {
      return existingRelated;
    }

    // If not, generate related articles based on keywords
    const allArticles: SummarizedNewsArticle[] = [];

    // Get all news articles
    Object.values(summarizedNewsArticles).forEach(articleArray => {
      allArticles.push(...articleArray);
    });

    const currentArticle = newsArticles.find(article => article.id === articleId);

    if (!currentArticle) return [];

    // Find articles that share keywords with the current article
    const related = allArticles
      .filter(article => article.id !== articleId) // Don't include the current article
      .filter(article => {
        // Check if any keywords match
        return article.keywords.some(keyword =>
          keywords.includes(keyword)
        );
      })
      .slice(0, 5); // Limit to 5 articles

    // Convert to RelatedArticle format
    return related.map((article, index) => {
      // Find the matching keyword
      const matchingKeywords = article.keywords.filter(k => keywords.includes(k));
      const matchingKeyword = matchingKeywords.length > 0 ? matchingKeywords[0] : '';

      return {
        id: `generated-related-${articleId}-${index}`,
        headline: article.headline,
        source: article.source,
        publishedTime: article.publishedTime,
        sentiment: article.sentiment,
        url: article.url,
        relationContext: matchingKeyword || 'Related Content'
      };
    });
  };

  // Handle showing related articles
  const handleShowRelated = (articleId: string) => {
    // Find the original article to get its keywords for context
    const originalArticle = newsArticles.find(article => article.id === articleId);

    if (originalArticle) {
      const keywords = originalArticle.keywords;
      const relatedForArticle = generateRelatedArticles(articleId, keywords);

      setCurrentRelatedArticles(relatedForArticle);
      setRelationTitle(keywords.join(', '));
      setIsRelatedOpen(true);
    }
  };

  // Handle refreshing news data
  const handleRefresh = () => {
    fetchNewsArticles();
  };

  // Toggle filter selection - and automatically apply the filter
  const toggleTickerSelection = (tickerSymbol: string) => {
    setSelectedTickers(prev => {
      // Create the new selected tickers array
      if (prev.includes(tickerSymbol)) {
        return prev.filter(t => t !== tickerSymbol);
      } else {
        return [...prev, tickerSymbol];
      }
    });
  };

  // Effect to apply filters whenever the selection changes
  useEffect(() => {
    // Only run if watchlist is loaded
    if (watchlistStocks.length > 0) {
      fetchNewsArticles();
    }
  }, [selectedTickers, ticker]);

  // Select all tickers and automatically apply
  const selectAllTickers = () => {
    setSelectedTickers([...availableTickers]);
  };

  // Clear all ticker selections and automatically apply
  const clearTickerSelections = () => {
    setSelectedTickers([]);
  };

  // Effect to fetch news when component mounts
  useEffect(() => {
    if (watchlistStocks.length > 0) {
      fetchNewsArticles();
    }
  }, [watchlistStocks.length]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content - News Feed */}
        <div className="lg:w-3/4 space-y-4">
          {/* Header Section */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Financial News
                {ticker && <span className="ml-2 text-primary">{ticker}</span>}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Updated {lastUpdated} • {newsArticles.length} articles
                {selectedTickers.length > 0 && selectedTickers.length < availableTickers.length && (
                  <span className="ml-2">
                    • Filtered: {selectedTickers.length}/{availableTickers.length} companies
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-3 sm:mt-0">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="lg:hidden inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Filter size={16} className="mr-2" />
                Filter
                {selectedTickers.length > 0 && selectedTickers.length < availableTickers.length && (
                  <span className="ml-1.5 w-5 h-5 bg-primary rounded-full text-black text-xs flex items-center justify-center">
                    {selectedTickers.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors disabled:bg-gray-400 disabled:text-gray-700"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* News Feed Section */}
          <div className="space-y-4">
            {loading ? (
              // Loading skeleton
              Array(3).fill(0).map((_, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden mb-4 p-4 border border-gray-200 dark:border-gray-700">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-md w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-md w-5/6 mb-3"></div>
                    <div className="flex space-x-2 mb-3">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : error ? (
              // Error state
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg p-4 text-center">
                <p className="text-red-800 dark:text-red-300">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-3 px-4 py-2 bg-primary text-black font-medium rounded-lg text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : newsArticles.length === 0 ? (
              // Empty state
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-300">No news articles available.</p>
              </div>
            ) : (
              // News articles list
              newsArticles.map((article) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  onShowRelated={handleShowRelated}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar - Filters */}
        <div className={`lg:w-1/4 lg:block ${isFilterOpen ? 'block' : 'hidden'}`}>
          <div className="sticky top-24 bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Companies</h3>

            <div className="flex justify-between mb-4">
              <button
                onClick={selectAllTickers}
                className="text-xs text-primary hover:text-primary/90"
              >
                Select All
              </button>
              <button
                onClick={clearTickerSelections}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto py-1 pr-1">
              {watchlistStocks.map((stock) => (
                <label
                  key={stock.symbol}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors
                    ${availableTickers.includes(stock.symbol)
                      ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                      : "opacity-50"}`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={selectedTickers.includes(stock.symbol)}
                      onChange={() => toggleTickerSelection(stock.symbol)}
                      disabled={!availableTickers.includes(stock.symbol)}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      {stock.symbol}
                    </span>
                  </div>

                  <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Related Articles Drawer */}
      <RelatedArticles
        articles={currentRelatedArticles}
        isOpen={isRelatedOpen}
        onClose={() => setIsRelatedOpen(false)}
        relationTitle={relationTitle}
      />
    </div>
  );
};