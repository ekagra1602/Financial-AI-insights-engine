import React from 'react';
import { SummarizedNewsArticle } from '../../types';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';

interface NewsCardProps {
  article: SummarizedNewsArticle;
  onShowRelated: (articleId: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ article, onShowRelated }) => {
  // Get sentiment icon and class
  const getSentimentDetails = (sentiment: string) => {
    switch(sentiment) {
      case 'positive':
        return {
          icon: <TrendingUp size={14} className="mr-1.5" />,
          class: 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800'
        };
      case 'negative':
        return {
          icon: <TrendingDown size={14} className="mr-1.5" />,
          class: 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
        };
      case 'neutral':
      default:
        return {
          icon: <Minus size={14} className="mr-1.5" />,
          class: 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-700'
        };
    }
  };

  // Get tone icon and class
  const getToneDetails = (tone: string) => {
    switch(tone) {
      case 'bullish':
        return {
          icon: <BarChart2 size={14} className="mr-1.5" />,
          class: 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm'
        };
      case 'bearish':
        return {
          icon: <BarChart2 size={14} className="mr-1.5 rotate-180" />,
          class: 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm'
        };
      case 'neutral':
      default:
        return {
          icon: <BarChart2 size={14} className="mr-1.5" />,
          class: 'bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
        };
    }
  };

  // Get sentiment and tone details
  const sentimentDetails = getSentimentDetails(article.sentiment);
  const toneDetails = getToneDetails(article.tone);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden mb-4 p-4 
      border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary 
      transition-all duration-200">
      <div className="flex flex-col">
        {/* Header with Ticker and Publication Info */}
        <div className="flex items-center mb-3">
          <div className="bg-primary text-black px-3 py-1.5 rounded-lg font-bold text-sm mr-2 shadow-sm">
            {article.ticker}
          </div>
          
          {/* Source and Time */}
          <div className="ml-auto flex items-center text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{article.source}</span>
            <span className="mx-2">•</span>
            <span>{article.publishedTime}</span>
          </div>
        </div>
        
        {/* Headline */}
        <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">
          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors duration-200"
          >
            {article.headline}
          </a>
        </h3>
        
        {/* Summary */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {article.summary}
        </p>
        
        {/* Sentiment and Tone Indicators - Professional Design */}
        <div className="flex items-center flex-wrap gap-3 mb-3">
          {/* Sentiment Indicator */}
          <div className={`flex items-center px-3 py-1.5 rounded-md border text-xs font-medium ${sentimentDetails.class}`}>
            {sentimentDetails.icon}
            <span className="mr-1 font-semibold">Sentiment:</span>
            <span className="capitalize">{article.sentiment}</span>
          </div>
          
          {/* Tone Indicator - Different design */}
          <div className={`flex items-center px-3 py-1.5 rounded-md border text-xs font-medium ${toneDetails.class}`}>
            {toneDetails.icon}
            <span className="mr-1 font-semibold">Market Tone:</span>
            <span className="capitalize">{article.tone}</span>
          </div>
        </div>
        
        {/* Keywords and Action Button */}
        <div className="flex flex-wrap justify-between items-center mt-1">
          {/* Keywords */}
          <div className="flex flex-wrap gap-1.5">
            {article.keywords.map((keyword, idx) => (
              <span 
                key={idx} 
                className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded"
              >
                {keyword}
              </span>
            ))}
          </div>
          
          {/* Action Button - with black text */}
          <button
            onClick={() => onShowRelated(article.id)}
            className="self-start mt-3 px-4 py-2 bg-primary text-black font-medium rounded-lg text-sm shadow-sm hover:bg-primary-dark transition-all"
          >
            Show Related Articles
          </button>
        </div>
      </div>
    </div>
  );
};