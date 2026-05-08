// Router configuration
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { NewsPage } from './pages/NewsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { RootLayout } from './layouts/RootLayout';
import SentimentPage from './pages/SentimentPage';
import RemindersPage from './pages/RemindersPage';

// Create the router with routes
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />
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
      },
      {
        path: '/reminders',
        element: <RemindersPage />
      }
    ]
  }
]);

export default router;