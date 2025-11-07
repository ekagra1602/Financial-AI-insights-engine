import { SummarizedNewsArticle, RelatedArticle } from '../types';

// Demo data for summarized news articles
export const summarizedNewsArticles: Record<string, SummarizedNewsArticle[]> = {
  // Apple news articles
  'AAPL': [
    {
      id: 'aapl-1',
      headline: 'Apple launches iPhone 16 with advanced AI features',
      source: 'Reuters',
      publishedTime: '2h ago',
      summary: 'Apple unveiled its new iPhone 16 lineup with enhanced AI capabilities, including advanced photo editing and voice assistant improvements. The company is betting on AI features to drive sales in a competitive smartphone market.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['iPhone16', 'AI', 'TimCook'],
      url: 'https://reuters.com/apple-iphone16-launch',
      ticker: 'AAPL',
    },
    {
      id: 'aapl-2',
      headline: 'Apple Stock Rises 2% After Earnings Beat',
      source: 'Bloomberg',
      publishedTime: '3h ago',
      summary: 'Q3 profits surpassed Wall Street estimates with revenue growth across all product categories. Services division showed particularly strong performance with 18% year-over-year growth.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['Earnings', 'Q3', 'Revenue'],
      url: 'https://bloomberg.com/apple-earnings-beat',
      ticker: 'AAPL',
    },
    {
      id: 'aapl-3',
      headline: 'Apple\'s China Sales Decline Amid Competitive Pressure',
      source: 'Wall Street Journal',
      publishedTime: '5h ago',
      summary: 'Apple reported a 2.5% year-over-year decline in Greater China revenue, reflecting increased competition from local smartphone makers like Huawei and Xiaomi. The company maintains it remains committed to the Chinese market.',
      sentiment: 'negative',
      tone: 'bearish',
      keywords: ['China', 'Revenue', 'Competition'],
      url: 'https://wsj.com/apple-china-sales',
      ticker: 'AAPL',
    },
    {
      id: 'aapl-4',
      headline: 'Apple Expands Manufacturing in India as Part of Supply Chain Diversification',
      source: 'Financial Times',
      publishedTime: '1d ago',
      summary: 'Apple continues to increase iPhone production in India as part of its strategy to reduce dependency on China manufacturing. The move comes amid ongoing trade tensions and supply chain concerns.',
      sentiment: 'neutral',
      tone: 'neutral',
      keywords: ['India', 'Manufacturing', 'SupplyChain'],
      url: 'https://ft.com/apple-india-manufacturing',
      ticker: 'AAPL',
    },
    {
      id: 'aapl-5',
      headline: 'Apple\'s Vision Pro: Mixed Reality Headset Sales Exceed Expectations',
      source: 'TechCrunch',
      publishedTime: '1d ago',
      summary: 'Apple\'s Vision Pro mixed reality headset has surpassed initial sales projections in its first quarter. Developer adoption is growing with over 1,000 specialized apps now available on the platform.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['VisionPro', 'AR', 'VR'],
      url: 'https://techcrunch.com/apple-vision-pro-sales',
      ticker: 'AAPL',
    }
  ],
  
  // Tesla news articles
  'TSLA': [
    {
      id: 'tsla-1',
      headline: 'Tesla Cybertruck Production Ramps Up to Meet Demand',
      source: 'Reuters',
      publishedTime: '4h ago',
      summary: 'Tesla announced it has successfully increased Cybertruck production rates, with the goal of producing 5,000 units per week by the end of the quarter. The company is working through early production challenges.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['Cybertruck', 'Production', 'ElonMusk'],
      url: 'https://reuters.com/tesla-cybertruck-production',
      ticker: 'TSLA',
    },
    {
      id: 'tsla-2',
      headline: 'Tesla\'s Full Self-Driving Software Faces Regulatory Scrutiny',
      source: 'Bloomberg',
      publishedTime: '6h ago',
      summary: 'Regulators are reviewing Tesla\'s Full Self-Driving beta software after reports of unexpected braking incidents. The company insists the technology is safe when used as directed with driver supervision.',
      sentiment: 'negative',
      tone: 'bearish',
      keywords: ['FSD', 'Regulation', 'Safety'],
      url: 'https://bloomberg.com/tesla-fsd-scrutiny',
      ticker: 'TSLA',
    },
    {
      id: 'tsla-3',
      headline: 'Tesla Energy Posts Record Quarter for Solar and Battery Storage',
      source: 'CleanTechnica',
      publishedTime: '1d ago',
      summary: 'Tesla\'s energy division reported record deployments of residential solar and Powerwall home batteries. The energy storage business grew 90% year-over-year as utility-scale projects accelerate.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['TeslaEnergy', 'Solar', 'Powerwall'],
      url: 'https://cleantechnica.com/tesla-energy-record',
      ticker: 'TSLA',
    }
  ],
  
  // Microsoft news articles
  'MSFT': [
    {
      id: 'msft-1',
      headline: 'Microsoft\'s Azure AI Services See 300% Growth, Boosting Cloud Revenue',
      source: 'CNBC',
      publishedTime: '3h ago',
      summary: 'Microsoft reported explosive growth in its Azure AI services, contributing to a 29% increase in overall cloud revenue. The company\'s partnership with OpenAI continues to drive enterprise AI adoption.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['Azure', 'AI', 'Cloud'],
      url: 'https://cnbc.com/microsoft-azure-growth',
      ticker: 'MSFT',
    },
    {
      id: 'msft-2',
      headline: 'Microsoft Faces Antitrust Scrutiny Over Teams Bundling',
      source: 'Wall Street Journal',
      publishedTime: '5h ago',
      summary: 'European regulators have opened a formal investigation into Microsoft\'s practice of bundling Teams with Microsoft 365. Competitors claim the practice violates fair competition principles.',
      sentiment: 'negative',
      tone: 'bearish',
      keywords: ['Antitrust', 'Teams', 'Regulation'],
      url: 'https://wsj.com/microsoft-antitrust-teams',
      ticker: 'MSFT',
    }
  ],
  
  // Oracle news articles
  'ORCL': [
    {
      id: 'orcl-1',
      headline: 'Oracle Reveals New AI Data Platform, Targeting Enterprise Customers',
      source: 'ZDNet',
      publishedTime: '7h ago',
      summary: 'Oracle has officially unveiled its Oracle AI Data Platform, an all-in-one system for enterprise AI applications. The platform integrates data management, processing, and analysis capabilities specifically optimized for AI workloads.',
      sentiment: 'positive',
      tone: 'bullish',
      keywords: ['AI', 'Enterprise', 'DataPlatform'],
      url: 'https://zdnet.com/oracle-ai-platform',
      ticker: 'ORCL',
    },
    {
      id: 'orcl-2',
      headline: 'Options Traders Flip Bearish as Oracle Stock Falters',
      source: '24/7 Wall St.',
      publishedTime: 'Nov 5',
      summary: 'Options market activity shows increasing bearish sentiment on Oracle stock following recent price weakness. Put volume has surged to three times the average daily volume over the past week.',
      sentiment: 'negative',
      tone: 'bearish',
      keywords: ['Options', 'Bearish', 'Trading'],
      url: 'https://247wallst.com/oracle-options',
      ticker: 'ORCL',
    }
  ]
};

// Demo data for related articles
export const relatedArticles: Record<string, RelatedArticle[]> = {
  'aapl-1': [
    {
      id: 'related-aapl-1-1',
      headline: 'Tesla integrates Apple AI tools in new infotainment system',
      source: 'The Verge',
      publishedTime: '1h ago',
      sentiment: 'positive',
      url: 'https://theverge.com/tesla-apple-ai-integration',
      relationContext: 'iPhone 16 AI features',
    },
    {
      id: 'related-aapl-1-2',
      headline: 'Rivian follows Apple\'s supply chain strategy amid component shortages',
      source: 'Automotive News',
      publishedTime: '2h ago',
      sentiment: 'neutral',
      url: 'https://autonews.com/rivian-supply-chain',
      relationContext: 'Supply Chain',
    },
    {
      id: 'related-aapl-1-3',
      headline: 'Samsung unveils Galaxy S25 with AI features to compete with iPhone 16',
      source: 'TechRadar',
      publishedTime: '3h ago',
      sentiment: 'neutral',
      url: 'https://techradar.com/samsung-galaxy-ai',
      relationContext: 'Smartphone AI Competition',
    },
    {
      id: 'related-aapl-1-4',
      headline: 'Google enhances Pixel camera AI in response to iPhone 16 launch',
      source: 'Android Authority',
      publishedTime: '5h ago',
      sentiment: 'positive',
      url: 'https://androidauthority.com/pixel-camera-ai-update',
      relationContext: 'AI Camera Technology',
    },
    {
      id: 'related-aapl-1-5',
      headline: 'Qualcomm\'s new AI chip powers iPhone 16 Pro models',
      source: 'Ars Technica',
      publishedTime: '6h ago',
      sentiment: 'positive',
      url: 'https://arstechnica.com/qualcomm-chip-iphone',
      relationContext: 'iPhone 16 Hardware',
    }
  ],
  'tsla-1': [
    {
      id: 'related-tsla-1-1',
      headline: 'Ford increases F-150 Lightning production to compete with Cybertruck',
      source: 'Automotive News',
      publishedTime: '5h ago',
      sentiment: 'neutral',
      url: 'https://autonews.com/ford-lightning-production',
      relationContext: 'Electric Truck Competition',
    },
    {
      id: 'related-tsla-1-2',
      headline: 'Rivian R1T deliveries hit new record as production stabilizes',
      source: 'Electrek',
      publishedTime: '1d ago',
      sentiment: 'positive',
      url: 'https://electrek.co/rivian-deliveries-record',
      relationContext: 'EV Truck Production',
    },
    {
      id: 'related-tsla-1-3',
      headline: 'Tesla secures additional battery supply for Cybertruck ramp',
      source: 'Reuters',
      publishedTime: '2d ago',
      sentiment: 'positive',
      url: 'https://reuters.com/tesla-battery-cybertruck',
      relationContext: 'Cybertruck Production',
    }
  ],
  'orcl-1': [
    {
      id: 'related-orcl-1-1',
      headline: 'AWS launches competing enterprise AI platform with lower pricing',
      source: 'TechCrunch',
      publishedTime: '4h ago',
      sentiment: 'neutral',
      url: 'https://techcrunch.com/aws-enterprise-ai',
      relationContext: 'Enterprise AI Competition',
    },
    {
      id: 'related-orcl-1-2',
      headline: 'Microsoft enhances Azure Data services with new AI capabilities',
      source: 'ZDNet',
      publishedTime: '1d ago',
      sentiment: 'positive',
      url: 'https://zdnet.com/microsoft-azure-data-ai',
      relationContext: 'Cloud AI Platforms',
    }
  ]
};