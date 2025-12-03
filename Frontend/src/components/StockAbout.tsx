import React, { useState } from 'react';

interface InfoItem {
  label: string;
  value: string;
}

interface StockAboutProps {
  description: string;
  companyInfo: InfoItem[];
}

const StockAbout: React.FC<StockAboutProps> = ({ description, companyInfo }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface rounded-xl p-6 mb-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">About</h2>

      <div className="border-b border-border mb-6"></div>

      <div className="mb-6">
        <p className="text-text-primary leading-relaxed">
          {expanded ? description : `${description.slice(0, 200)}...`}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-negative font-semibold mt-2 hover:text-opacity-80 transition-opacity"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {companyInfo.map((item, index) => (
          <div key={index}>
            <div className="text-text-secondary text-sm mb-1">{item.label}</div>
            <div className="text-text-primary font-medium">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockAbout;

