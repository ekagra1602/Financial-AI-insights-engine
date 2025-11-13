import { StockData, PortfolioDataPoint, NewsArticle, DailyMover, TimePeriod } from '../types';

// Helper function to generate sparkline data
const generateSparkline = (trend: 'up' | 'down' | 'volatile', points: number = 20): number[] => {
  const data: number[] = [];
  let value = 100;
  
  for (let i = 0; i < points; i++) {
    if (trend === 'up') {
      value += Math.random() * 3 - 1;
    } else if (trend === 'down') {
      value -= Math.random() * 3 - 1;
    } else {
      value += Math.random() * 6 - 3;
    }
    data.push(Math.max(0, value));
  }
  
  return data;
};

// Stock watchlist data
export const stockWatchlist: StockData[] = [
  {
    symbol: 'META',
    price: 621.19,
    change: -14.72,
    changePercent: -2.32,
    shares: 2,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'ORCL',
    price: 245.02,
    change: -5.30,
    changePercent: -2.12,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'SPX',
    name: 'S&P 500 Index',
    price: 6745.29,
    change: -50.92,
    changePercent: -0.75,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'SOFI',
    price: 27.81,
    change: -2.18,
    changePercent: -7.52,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'ABNB',
    price: 121.64,
    change: -0.86,
    changePercent: -0.70,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'TSLA',
    price: 449.46,
    change: -12.52,
    changePercent: -2.73,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'NVDA',
    price: 189.58,
    change: -5.62,
    changePercent: -2.88,
    sparklineData: generateSparkline('down'),
  },
  {
    symbol: 'AAPL',
    price: 271.29,
    change: 1.15,
    changePercent: 0.43,
    sparklineData: generateSparkline('up'),
  },
  {
    symbol: 'LCID',
    price: 17.73,
    change: 0.49,
    changePercent: 2.84,
    sparklineData: generateSparkline('up'),
  },
  {
    symbol: 'AMZN',
    price: 244.38,
    change: -5.82,
    changePercent: -2.33,
    sparklineData: generateSparkline('down'),
  },
];

// Portfolio data for different time periods
const generatePortfolioData = (period: TimePeriod, endValue: number): PortfolioDataPoint[] => {
  const data: PortfolioDataPoint[] = [];
  const now = Date.now();
  let points = 100;
  let timeStep = 3600000; // 1 hour
  
  switch (period) {
    case '1D':
      points = 78; // Trading hours
      timeStep = 5 * 60000; // 5 minutes
      break;
    case '1W':
      points = 35;
      timeStep = 3600000 * 4; // 4 hours
      break;
    case '1M':
      points = 30;
      timeStep = 86400000; // 1 day
      break;
    case '3M':
      points = 90;
      timeStep = 86400000;
      break;
    case 'YTD':
      points = 220;
      timeStep = 86400000;
      break;
    case '1Y':
      points = 252;
      timeStep = 86400000;
      break;
    case 'ALL':
      points = 1000;
      timeStep = 86400000;
      break;
  }
  
  let value = endValue / 0.97; // Start higher for downward trend
  
  for (let i = 0; i < points; i++) {
    const timestamp = now - (points - i) * timeStep;
    
    // Simulate gradual decline with volatility
    if (i < points * 0.7) {
      value += Math.random() * 20 - 8;
    } else {
      value -= Math.random() * 25 - 5; // Sharper decline at end
    }
    
    data.push({
      timestamp,
      value: Math.max(0, value),
    });
  }
  
  // Ensure last point matches current value
  data[data.length - 1].value = endValue;
  
  return data;
};

export const portfolioData: Record<TimePeriod, PortfolioDataPoint[]> = {
  '1D': generatePortfolioData('1D', 1242.37),
  '1W': generatePortfolioData('1W', 1242.37),
  '1M': generatePortfolioData('1M', 1242.37),
  '3M': generatePortfolioData('3M', 1242.37),
  'YTD': generatePortfolioData('YTD', 1242.37),
  '1Y': generatePortfolioData('1Y', 1242.37),
  'ALL': generatePortfolioData('ALL', 1242.37),
};

// News articles
export const newsArticles: NewsArticle[] = [
  {
    id: '1',
    source: "Investor's Guild",
    timeAgo: '1d',
    title: 'Is something wrong? Fed liquidity watch',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop',
  },
  {
    id: '2',
    source: 'MarketWatch',
    timeAgo: '7m',
    title: "Microsoft's stock is suffering its longest losing streak in years. What gives?",
    ticker: 'MSFT',
    change: -1.73,
    imageUrl: 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=400&h=200&fit=crop',
  },
  {
    id: '3',
    source: 'TipRanks',
    timeAgo: '32m',
    title: "Oracle Cloud Infrastructure Sees Major Growth in Enterprise Adoption",
    ticker: 'ORCL',
    change: -2.83,
  },
];

// Daily movers
export const dailyMovers: DailyMover[] = [
  {
    symbol: 'Sitime',
    name: 'Sitime',
    price: 349.22,
    changePercent: 25.14,
  },
  {
    symbol: 'SkyWater',
    name: 'SkyWater Technology',
    price: 18.64,
    changePercent: 26.72,
  },
  {
    symbol: 'Brighthouse',
    name: 'Brighthouse Financial',
    price: 65.79,
    changePercent: 27.01,
  },
  {
    symbol: 'Embla Medical',
    name: 'Embla Medical HF',
    price: 5.09,
    changePercent: 27.25,
  },
  {
    symbol: 'Backblaze',
    name: 'Backblaze',
    price: 6.36,
    changePercent: -31.91,
  },
  {
    symbol: 'Haemonetics',
    name: 'Haemonetics',
    price: 66.79,
    changePercent: 31.68,
  },
];

// Featured stock detail (Oracle)
export const featuredStock = {
  symbol: 'ORCL',
  companyName: 'Oracle',
  price: 243.28,
  change: -7.09,
  changePercent: -2.83,
  marketStatus: '24 Hour Market',
  about: {
    description: 'Oracle Corp. engages in the provision of products and services that address aspects of corporate information technology environments, including applications and infrastructure technologies. It operates through the following business segments: Cloud and License, Hardware, and Services.',
    companyInfo: {
      ceo: 'Michael Sicilia',
      employees: '162,000',
      headquarters: 'Austin, Texas',
      founded: '1977',
    },
  },
  statistics: [
    { label: 'Market cap', value: '693.58B' },
    { label: 'Price-Earnings ratio', value: '57.95' },
    { label: 'Dividend yield', value: '0.76%' },
    { label: 'Average volume', value: '16.67M' },
    { label: 'High today', value: '$251.33' },
    { label: 'Low today', value: '$239.30' },
    { label: 'Open price', value: '$248.23' },
    { label: 'Volume', value: '15.76M' },
    { label: '52 Week high', value: '$345.72' },
    { label: '52 Week low', value: '$118.86' },
  ],
};

// News articles for stock detail page
export const stockNewsArticles = [
  {
    id: '1',
    source: 'Barchart',
    timeAgo: '7h',
    title: 'As Oracle Reveals Its new AI Data Platform, Should You Buy, Hold, or Sell ORCL Stock?',
    excerpt: 'Oracle (ORCL) is advancing boldly in the artificial intelligence (AI) arena, having officially unveiled its Oracle AI Data Platform, an ambitious all-in-one sys...',
  },
  {
    id: '2',
    source: '24/7 Wall St.',
    timeAgo: 'Nov 5',
    title: 'Options Traders Flip Bearish as Oracle Falters',
    excerpt: 'Home Investing Options Traders Flip Bearish as Oracle (ORCL) Falters Investing Options Traders Flip Bearish as Oracle (ORCL) Falters By Douglas A. McIntyre N...',
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=200&fit=crop',
  },
  {
    id: '3',
    source: 'The Motley Fool',
    timeAgo: 'Nov 5',
    title: 'With the "Magnificent Seven" at 35% of the S&P 500 and the "Ten Titans" at 40%, Are AI Growth Stocks Poised for a Sell-Off or Is There Still Room to Run?',
    excerpt: 'Market noise is intensifying, showcasing why buying and holding stocks at all-time highs takes focus and conviction. For over a decade, the simplest way to out...',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=200&fit=crop',
  },
];

// Trading trends data
export const tradingTrendsData = [
  { date: 'Oct 7', netBuyVolume: 15, netSellVolume: -8, stockPrice: 305 },
  { date: 'Oct 8', netBuyVolume: 0, netSellVolume: -18, stockPrice: 308 },
  { date: 'Oct 9', netBuyVolume: 0, netSellVolume: -15, stockPrice: 310 },
  { date: 'Oct 10', netBuyVolume: 0, netSellVolume: -18, stockPrice: 312 },
  { date: 'Oct 11', netBuyVolume: 0, netSellVolume: -35, stockPrice: 315 },
  { date: 'Oct 14', netBuyVolume: 20, netSellVolume: -10, stockPrice: 318 },
  { date: 'Oct 15', netBuyVolume: 0, netSellVolume: -12, stockPrice: 316 },
  { date: 'Oct 16', netBuyVolume: 0, netSellVolume: -28, stockPrice: 314 },
  { date: 'Oct 17', netBuyVolume: 38, netSellVolume: 0, stockPrice: 310 },
  { date: 'Oct 18', netBuyVolume: 50, netSellVolume: 0, stockPrice: 305 },
  { date: 'Oct 21', netBuyVolume: 8, netSellVolume: -3, stockPrice: 298 },
  { date: 'Oct 22', netBuyVolume: 0, netSellVolume: -5, stockPrice: 295 },
  { date: 'Oct 23', netBuyVolume: 0, netSellVolume: -45, stockPrice: 292 },
  { date: 'Oct 24', netBuyVolume: 0, netSellVolume: -22, stockPrice: 290 },
  { date: 'Oct 25', netBuyVolume: 35, netSellVolume: 0, stockPrice: 288 },
  { date: 'Oct 28', netBuyVolume: 0, netSellVolume: -30, stockPrice: 285 },
  { date: 'Oct 29', netBuyVolume: 28, netSellVolume: 0, stockPrice: 282 },
  { date: 'Oct 30', netBuyVolume: 25, netSellVolume: 0, stockPrice: 278 },
  { date: 'Oct 31', netBuyVolume: 22, netSellVolume: -5, stockPrice: 270 },
  { date: 'Nov 1', netBuyVolume: 15, netSellVolume: 0, stockPrice: 265 },
  { date: 'Nov 4', netBuyVolume: 12, netSellVolume: 0, stockPrice: 258 },
  { date: 'Nov 5', netBuyVolume: 10, netSellVolume: 0, stockPrice: 248 },
];

