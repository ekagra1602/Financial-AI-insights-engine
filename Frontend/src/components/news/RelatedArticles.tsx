import React from 'react';
import { RelatedArticle } from '../../types';
import { X } from 'lucide-react';

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
        return <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">Positive</span>;
      case 'negative':
        return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium">Negative</span>;
      case 'neutral':
      default:
        return <span className="px-2 py-0.5 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs font-medium">Neutral</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-800 shadow-xl flex flex-col overflow-hidden">
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
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-3 hover:shadow-md transition-shadow"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {article.headline}
                </h4>
                
                <div className="flex justify-between items-center text-sm mb-2">
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{article.source}</span>
                    <span>•</span>
                    <span>{article.publishedTime}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  {getSentimentBadge(article.sentiment)}
                  
                  {article.relationContext && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {article.relationContext}
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