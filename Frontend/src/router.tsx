// Router configuration
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { NewsPage } from './pages/NewsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { RootLayout } from './layouts/RootLayout';
import WebSearch from './components/WebSearch';
import SentimentPage from './pages/SentimentPage';

// Create the router with routes
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <App />
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
      },
      {
        path: '/sentiment-reports',
        element: <SentimentPage />
      }
    ]
  }
]);

export default router;