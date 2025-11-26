import React from 'react';
import { RelatedArticle } from '../../types';
import { X, BarChart2 } from 'lucide-react';

interface RelatedArticlesProps {
  articles: RelatedArticle[];
  isOpen: boolean;
  onClose: () => void;
  relationTitle?: string;
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  articles,
  isOpen,
  onClose,
  relationTitle,
}) => {
  // More professional sentiment indicators
  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 rounded text-xs font-medium">Positive</span>;
      case 'negative':
        return <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded text-xs font-medium">Negative</span>;
      case 'neutral':
      default:
        return <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded text-xs font-medium">Neutral</span>;
    }
  };

  // Get tone badge
  const getToneBadge = (tone?: string) => {
    if (!tone) return null;
    
    switch (tone) {
      case 'bullish':
        return (
          <div className="flex items-center px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-xs font-medium text-blue-800 dark:text-blue-300">
            <BarChart2 size={12} className="mr-1" />
            <span>Bullish</span>
          </div>
        );
      case 'bearish':
        return (
          <div className="flex items-center px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded text-xs font-medium text-amber-800 dark:text-amber-300">
            <BarChart2 size={12} className="mr-1 rotate-180" />
            <span>Bearish</span>
          </div>
        );
      case 'neutral':
      default:
        return (
          <div className="flex items-center px-2 py-0.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-medium text-slate-700 dark:text-slate-300">
            <BarChart2 size={12} className="mr-1" />
            <span>Neutral</span>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] lg:w-[700px] bg-white dark:bg-slate-800 shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {relationTitle ? (
            <span>Related to: {relationTitle}</span>
          ) : (
            <span>Related Articles</span>
          )}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close panel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {articles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">No related articles found</p>
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 hover:shadow-lg transition-all"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {/* Header with Ticker and Metadata */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {article.ticker && (
                      <div className="bg-primary text-black px-3 py-1 rounded-lg font-bold text-sm shadow-sm">
                        {article.ticker}
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{article.source}</span>
                      <span>•</span>
                      <span>{article.publishedTime}</span>
                    </div>
                  </div>
                </div>
                
                {/* Headline */}
                <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3 hover:text-primary transition-colors">
                  {article.headline}
                </h4>
                
                {/* Sentiment, Tone, and Relation Context */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {getSentimentBadge(article.sentiment)}
                  {getToneBadge(article.tone)}
                  
                  {article.relationContext && (
                    <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs">
                      Related: {article.relationContext}
                    </div>
                  )}
                </div>
              </a>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-primary text-black font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
};