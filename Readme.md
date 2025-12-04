# Qualcomm AI Financial Insights Engine - Capstone

A modern financial insights dashboard with AI capabilities for portfolio management, stock analysis, and market insights.

## 📁 Project Structure

```
qualcomm-financial-insights-engine/
├── Frontend/                 # React + TypeScript Dashboard
│   ├── src/
│   │   ├── components/      # React UI components
│   │   ├── data/           # Demo data and types
│   │   └── App.tsx         # Main application
│   ├── package.json        # Frontend dependencies
│   ├── README.md          # Frontend documentation
│   └── QUICKSTART.md      # Quick start guide
└── README.md              # This file
```

## 🚀 Getting Started

### Frontend Dashboard

The frontend is a modern React application with a beautiful financial dashboard interface.

**Quick Start:**
```bash
cd Frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to view the dashboard.

For detailed instructions, see [Frontend/QUICKSTART.md](Frontend/QUICKSTART.md)

## ✨ Features

### Current Features (v0.1)
- ✅ **Stock Detail View**: Individual stock analysis with detailed metrics
- ✅ **Interactive Charts**: Multi-period charting (1D, 1W, 1M, 3M, YTD, 1Y, 5Y, MAX)
- ✅ **Company Information**: About section with CEO, employees, headquarters, founded date
- ✅ **Key Statistics**: Market cap, P/E ratio, dividend yield, volume, and more
- ✅ **Stock Watchlist**: Custom stock lists with mini sparkline charts
- ✅ **AI Integration Ready**: Insights and Chatbot navigation
- ✅ **Dark Theme UI**: Modern, responsive design
- ✅ **Demo Data**: Full demo data for testing and development

### Planned Features
- 🔄 **Real-time Data Integration**: Live market data via APIs
- 🔄 **AI Insights**: Qualcomm AI-powered market analysis
- 🔄 **User Authentication**: Secure user accounts
- 🔄 **Portfolio Management**: Add/remove stocks, track performance
- 🔄 **Price Alerts**: Get notified of significant price changes
- 🔄 **Technical Analysis**: Advanced charting with indicators
- 🔄 **Backend API**: RESTful API for data management

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next-generation build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Composable charting library
- **Lucide Icons** - Beautiful icon set

### Planned Backend
- **Python/FastAPI** - High-performance API
- **PostgreSQL** - Relational database
- **Redis** - Caching layer
- **Qualcomm AI SDK** - AI-powered insights

## 📊 Dashboard Features

### Stock Detail View
- Individual stock tracking (Oracle as featured example)
- Current price with daily change tracking
- 24-hour market status indicator
- Advanced charting button
- Notification bell for price alerts

### Interactive Charting
- Multi-period analysis (1D, 1W, 1M, 3M, YTD, 1Y, 5Y, MAX)
- Smooth area charts with gradient fills
- Interactive tooltips with precise values
- Responsive design for all screen sizes

### Company Information
- About section with detailed company description
- CEO name and contact information
- Employee count
- Headquarters location
- Founded date

### Key Statistics
- Market capitalization
- Price-Earnings ratio
- Dividend yield
- Trading volume metrics
- 52-week high/low
- Open price and today's range

### Stock Watchlist
- Real-time price updates
- Mini sparkline charts for trend visualization
- Color-coded gains/losses
- Customizable stock lists
- Share count tracking

### AI-Ready Navigation
- Insights button for AI-powered market analysis
- Chatbot button for interactive queries
- Integration ready for Qualcomm AI features

## 🎨 Design Philosophy

- **Clean & Modern**: Minimalist design focused on data
- **Dark Theme**: Reduced eye strain for extended use
- **Responsive**: Works seamlessly on all devices
- **Fast**: Optimized performance with Vite and React
- **Accessible**: WCAG compliant color contrasts

## 📈 Demo Data

The application comes with comprehensive demo data including:
- Portfolio performance data for all time periods
- 10+ popular stock tickers (META, AAPL, TSLA, NVDA, etc.)
- Financial news articles
- Daily market movers
- Sparkline data for trend visualization

## 🔧 Development

### Prerequisites
- Node.js 16+ and npm
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd qualcomm-financial-insights-engine

# Quick Start (Recommended)
# This script installs dependencies and starts both frontend and backend
./start.sh
```

### Manual Installation (Alternative)
```bash
# Install frontend dependencies
cd Frontend
npm install

# Start development server
npm run dev
```

### Building for Production
```bash
cd Frontend
npm run build
```

## 📝 Branch Information

Current branch: `ekagra-frontend`

## 🤝 Contributing

This is a capstone project for Qualcomm. For questions or contributions, please contact the development team.

## 📄 License

© 2025 Qualcomm AI Financial Insights Engine - Capstone Project

---

For more details about the frontend, see [Frontend/README.md](Frontend/README.md)