# Financial Insights Dashboard

A modern, responsive financial dashboard built with React, TypeScript, and Tailwind CSS. This application provides a comprehensive view of your investment portfolio with real-time charts, stock watchlists, and financial news.

## Features

### 📊 Portfolio Dashboard
- **Real-time Portfolio Tracking**: View your total portfolio value with daily changes
- **Interactive Charts**: Beautiful area charts with multiple time periods (1D, 1W, 1M, 3M, YTD, 1Y, ALL)
- **Responsive Design**: Optimized for desktop and mobile devices
- **Dark Theme**: Modern dark UI inspired by leading financial platforms

### 📈 Stock Watchlist
- **Mini Sparkline Charts**: Quick visual representation of stock trends
- **Real-time Price Updates**: Current prices with percentage changes
- **Organized Lists**: Group stocks into custom watchlists
- **Color-coded Performance**: Green for gains, red for losses

### 📰 News Feed
- **Latest Financial News**: Stay updated with market news and insights
- **Daily Movers**: See the biggest stock movements of the day
- **Article Previews**: Quick access to relevant financial news with images

### 🎨 Modern UI Components
- Built with **React 18** and **TypeScript** for type safety
- Styled with **Tailwind CSS** for rapid development
- **Recharts** for beautiful, responsive charts
- **Lucide Icons** for consistent iconography

## Tech Stack

- **React 18.2**: Modern React with hooks and functional components
- **TypeScript 5.2**: Full type safety and better developer experience
- **Vite 5**: Lightning-fast build tool and dev server
- **Tailwind CSS 3**: Utility-first CSS framework
- **Recharts 2**: Composable charting library
- **Lucide React**: Beautiful & consistent icon set

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn installed

### Installation

1. Navigate to the Frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and visit `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The optimized production build will be in the `dist` folder.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
Frontend/
├── src/
│   ├── components/           # React components
│   │   ├── Header.tsx       # Top navigation bar
│   │   ├── PortfolioHeader.tsx  # Portfolio value display
│   │   ├── PortfolioChart.tsx   # Interactive chart
│   │   ├── StockWatchlist.tsx   # Stock list sidebar
│   │   ├── NewsFeed.tsx     # News articles & daily movers
│   │   └── Sparkline.tsx    # Mini chart component
│   ├── data/
│   │   └── demoData.ts      # Demo data for stocks, portfolio, news
│   ├── types.ts             # TypeScript type definitions
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── public/                   # Static assets
├── index.html               # HTML template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind configuration
└── vite.config.ts           # Vite configuration
```

## Features Breakdown

### Portfolio Chart
- Multiple time period views (1D to ALL time)
- Smooth animations and transitions
- Interactive tooltips showing exact values
- Responsive to all screen sizes
- Custom color gradient for visual appeal

### Stock Watchlist
- Collapsible list groups
- Individual stock holdings with share counts
- Mini sparkline charts for quick trend visualization
- Hover effects for better UX

### News Feed
- Dynamic news article cards
- Stock ticker integration with news
- Daily movers section highlighting biggest gainers/losers
- Responsive grid layout

## Customization

### Colors
The color scheme is defined in `tailwind.config.js`. You can customize:
- Background colors
- Text colors
- Accent colors (positive/negative)
- Surface colors

### Demo Data
All demo data is centralized in `src/data/demoData.ts`. You can:
- Modify stock prices and changes
- Add/remove stocks from watchlist
- Update news articles
- Change portfolio values

## Future Enhancements

- [ ] Real-time data integration with financial APIs
- [ ] User authentication and personalized portfolios
- [ ] Advanced charting with technical indicators
- [ ] Stock search and filtering
- [ ] Customizable watchlists
- [ ] Push notifications for price alerts
- [ ] Mobile app version
- [ ] Options trading view
- [ ] Cryptocurrency support

## Performance

- **Fast Refresh**: Instant feedback during development
- **Code Splitting**: Optimized bundle sizes
- **Lazy Loading**: Components loaded on demand
- **Optimized Images**: Efficient asset loading

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is part of the Qualcomm AI Financial Insights Engine capstone project.

## Contributing

This is a capstone project. For questions or suggestions, please reach out to the development team.

