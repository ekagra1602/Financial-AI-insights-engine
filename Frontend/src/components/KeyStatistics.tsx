import React from 'react';

interface Statistic {
  label: string;
  value: string;
}

interface KeyStatisticsProps {
  stats: Statistic[];
}

const KeyStatistics: React.FC<KeyStatisticsProps> = ({ stats }) => {
  return (
    <div className="bg-surface rounded-xl p-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">Key statistics</h2>
      
      <div className="border-b border-border mb-6"></div>

      <div className="grid grid-cols-4 gap-x-8 gap-y-6">
        {stats.map((stat, index) => (
          <div key={index}>
            <div className="text-text-secondary text-sm mb-1">{stat.label}</div>
            <div className="text-text-primary font-medium">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyStatistics;

