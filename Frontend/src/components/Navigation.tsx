import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Newspaper, Bell } from 'lucide-react';

export const Navigation: React.FC = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-slate-900 text-white shadow-md fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <div className="text-2xl font-bold text-primary mr-2">
                  <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M16 2L2 9v14c0 8 14 7 14 7s14 1 14-7V9L16 2z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white">FinInsight</span>
              </Link>
            </div>
            
            {/* Main Navigation Links */}
            <div className="ml-10 flex items-center space-x-4">
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors 
                  ${location.pathname === '/' 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                <span className="flex items-center">
                  <Home size={16} className="mr-1.5" />
                  Dashboard
                </span>
              </Link>
              
              <Link 
                to="/news" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${location.pathname.includes('/news') 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                <span className="flex items-center">
                  <Newspaper size={16} className="mr-1.5" />
                  News
                </span>
              </Link>
            </div>
          </div>
          
          {/* Right side actions */}
          <div className="flex items-center">
            <div className="relative px-3 py-2">
              <Bell size={18} className="text-gray-300 hover:text-white cursor-pointer" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-xs">
                1
              </span>
            </div>
            <button className="ml-4 px-3 py-1 border border-gray-600 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              Account
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};