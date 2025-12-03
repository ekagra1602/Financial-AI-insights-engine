// Router configuration
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { NewsPage } from './pages/NewsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { RootLayout } from './layouts/RootLayout';
import WebSearch from './components/WebSearch';

// Create the router with routes
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/stock/ORCL" replace />
      },
      {
        path: '/stock/:symbol',
        element: <StockDetailPage />
      },
      {
        path: '/web-search',
        element: <WebSearch />
      },
      {
        path: '/news',
        element: <NewsPage />
      },
      {
        path: '/chatbot',
        element: <ChatbotPage />
      },
      // Keep compatibility with old URLs
      {
        path: '/news/:ticker',
        element: <NewsPage />
      }
    ]
  }
]);

export default router;