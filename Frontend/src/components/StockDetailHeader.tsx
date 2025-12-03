import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface StockDetailHeaderProps {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  marketStatus?: string;
}

const StockDetailHeader: React.FC<StockDetailHeaderProps> = ({
  symbol,
  companyName,
  price,
  change,
  changePercent,
  marketStatus = '24 Hour Market',
}) => {
  const isNegative = change < 0;
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          {companyName} <span className="text-text-secondary text-sm ml-2">{symbol}</span>
        </h1>
        <div className="text-5xl font-bold text-text-primary mb-2">
          ${price.toFixed(2)}
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-base font-medium ${isNegative ? 'text-negative' : 'text-positive'}`}>
            {isNegative ? '' : '+'}{change.toFixed(2)} ({isNegative ? '' : '+'}{changePercent.toFixed(2)}%) Today
          </div>
          {marketStatus && (
            <div className="text-text-secondary text-sm">
              {marketStatus}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg border border-border hover:bg-surface-light transition-colors">
          <Bell className="w-5 h-5 text-text-primary" />
        </button>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg border border-border hover:bg-surface-light transition-colors flex items-center gap-2 text-text-primary"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default StockDetailHeader;

