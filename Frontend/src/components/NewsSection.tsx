import React from 'react';

interface NewsArticle {
  id: string;
  source: string;
  timeAgo: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
}

interface NewsSectionProps {
  articles: NewsArticle[];
}

const NewsSection: React.FC<NewsSectionProps> = ({ articles }) => {
  return (
    <div className="bg-surface rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">News</h2>
        <button className="text-negative font-semibold hover:text-opacity-80 transition-opacity">
          Show more
        </button>
      </div>
      
      <div className="border-b border-border mb-6"></div>

      <div className="space-y-6">
        {articles.map((article) => (
          <div
            key={article.id}
            className="hover:bg-surface-light p-4 -mx-4 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                  <span className="font-medium">{article.source}</span>
                  <span>{article.timeAgo}</span>
                </div>
                <h3 className="text-text-primary font-semibold text-lg mb-2 leading-snug">
                  {article.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {article.excerpt}
                </p>
              </div>
              {article.imageUrl && (
                <div className="w-48 h-32 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsSection;

