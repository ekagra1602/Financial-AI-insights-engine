import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { NewsPage } from './pages/NewsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { RootLayout } from './layouts/RootLayout';
import WebSearch from './components/WebSearch';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';

// Create the router with routes
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: <Login />
      },
      {
        path: '/register',
        element: <Register />
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <App />
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
    ]
  }
]);

export default router;