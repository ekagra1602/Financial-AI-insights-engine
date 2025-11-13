import React from 'react';
import { newsArticles, dailyMovers } from '../data/demoData';

const NewsFeed: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* News Articles */}
      <div className="space-y-4">
        {newsArticles.map((article) => (
          <div
            key={article.id}
            className="bg-surface rounded-xl p-4 hover:bg-surface-light transition-colors cursor-pointer"
          >
            <div className="flex gap-4">
              {article.imageUrl && (
                <div className="w-32 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{article.timeAgo}</span>
                </div>
                <h3 className="text-text-primary font-medium mb-2 leading-snug">
                  {article.title}
                </h3>
                {article.ticker && article.change !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-semibold">{article.ticker}</span>
                    <span className={`text-sm ${article.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {article.change >= 0 ? '▲' : '▼'} {Math.abs(article.change).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Movers */}
      <div className="bg-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Daily movers</h2>
          <button className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Show More
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Stocks making the biggest moves today.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {dailyMovers.map((mover) => (
            <div
              key={mover.symbol}
              className="bg-surface-light rounded-lg p-4 hover:bg-opacity-80 transition-colors cursor-pointer"
            >
              <div className="text-text-primary font-semibold mb-1">{mover.symbol}</div>
              <div className="text-2xl font-bold text-text-primary mb-1">
                ${mover.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div
                className={`text-sm font-medium ${
                  mover.changePercent >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {mover.changePercent >= 0 ? '+' : ''}{mover.changePercent.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsFeed;

