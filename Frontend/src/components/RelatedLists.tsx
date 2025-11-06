import React from 'react';
import { TrendingUp, Clock, Code, MapPin } from 'lucide-react';

interface ListItem {
  id: string;
  name: string;
  icon: 'trending' | 'clock' | 'code' | 'location';
  color: string;
}

const lists: ListItem[] = [
  { id: '1', name: '100 Most Popular', icon: 'trending', color: '#ff6b9d' },
  { id: '2', name: '24 Hour Market', icon: 'clock', color: '#4a9eff' },
  { id: '3', name: 'Software', icon: 'code', color: '#6b8cff' },
  { id: '4', name: 'Texas', icon: 'location', color: '#4ecbff' },
];

const RelatedLists: React.FC = () => {
  const getIcon = (type: string, color: string) => {
    const iconProps = { className: 'w-4 h-4', style: { color } };
    switch (type) {
      case 'trending':
        return <TrendingUp {...iconProps} />;
      case 'clock':
        return <Clock {...iconProps} />;
      case 'code':
        return <Code {...iconProps} />;
      case 'location':
        return <MapPin {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-surface rounded-xl p-6 mb-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-6">Related lists</h2>
      
      <div className="border-b border-border mb-6"></div>

      <div className="flex flex-wrap gap-3">
        {lists.map((list) => (
          <button
            key={list.id}
            className="flex items-center gap-2 px-4 py-2 bg-surface-light rounded-full hover:bg-opacity-80 transition-colors"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: list.color }}
            >
              {getIcon(list.icon, '#ffffff')}
            </div>
            <span className="text-text-primary font-medium">{list.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RelatedLists;

