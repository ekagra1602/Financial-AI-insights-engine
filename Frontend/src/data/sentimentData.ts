import { SentimentReport } from '../types';

export const demoSentimentReport: SentimentReport = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  horizon: '1M',
  generatedAt: new Date().toISOString(),
  forecast: {
    probabilityUp: 68.5,
    expectedReturn: 4.2,
    quantiles: {
      q10: -2.1,
      q50: 3.8,
      q90: 10.5,
    },
    uncertainty: 15.2,
    modelBreakdown: [
      { modelName: 'Technical Analysis', weight: 0.35, contribution: 2.1 },
      { modelName: 'Sentiment Analysis', weight: 0.25, contribution: 1.5 },
      { modelName: 'Fundamental Model', weight: 0.25, contribution: 0.8 },
      { modelName: 'Market Context', weight: 0.15, contribution: -0.2 },
    ],
  },
  risk: {
    flags: [
      {
        id: 'rf1',
        severity: 'medium',
        message: 'Elevated market volatility detected in tech sector',
      },
      {
        id: 'rf2',
        severity: 'low',
        message: 'Upcoming earnings report may impact price',
      },
    ],
    topDrivers: [
      {
        id: 'd1',
        factor: 'iPhone Sales Momentum',
        impact: 0.85,
        description: 'Strong iPhone 15 sales in Q4 showing positive momentum in key markets',
      },
      {
        id: 'd2',
        factor: 'Services Revenue Growth',
        impact: 0.72,
        description: 'Continued expansion in services segment with subscription growth',
      },
      {
        id: 'd3',
        factor: 'AI Integration Plans',
        impact: 0.68,
        description: 'Market optimism around upcoming AI features and capabilities',
      },
      {
        id: 'd4',
        factor: 'Supply Chain Stability',
        impact: 0.55,
        description: 'Improved supply chain resilience and manufacturing efficiency',
      },
      {
        id: 'd5',
        factor: 'Competitive Pressure',
        impact: -0.35,
        description: 'Increased competition in smartphone and wearables markets',
      },
    ],
    confidenceScore: 82.5,
  },
  narrative: {
    stance: 'bullish',
    explanation:
      'Apple demonstrates strong fundamentals with robust iPhone sales momentum and expanding services revenue. The company\'s strategic positioning in AI integration and sustained brand loyalty provide upside potential. While facing competitive headwinds in certain segments, the overall outlook remains positive with a 68.5% probability of price increase over the next month. Key catalysts include upcoming product launches and continued ecosystem expansion.',
  },
  recentPrices: [178.5, 179.2, 177.8, 180.1, 181.5, 180.9, 182.3, 181.7, 183.2, 182.8, 184.1, 183.5, 185.2, 186.0, 185.3],
};

export const demoReports: { [ticker: string]: SentimentReport } = {
  AAPL: demoSentimentReport,
  GOOGL: {
    ticker: 'GOOGL',
    companyName: 'Alphabet Inc.',
    horizon: '1M',
    generatedAt: new Date().toISOString(),
    forecast: {
      probabilityUp: 72.3,
      expectedReturn: 5.8,
      quantiles: {
        q10: -1.5,
        q50: 5.2,
        q90: 12.8,
      },
      uncertainty: 12.8,
      modelBreakdown: [
        { modelName: 'Technical Analysis', weight: 0.3, contribution: 2.5 },
        { modelName: 'Sentiment Analysis', weight: 0.3, contribution: 2.1 },
        { modelName: 'Fundamental Model', weight: 0.25, contribution: 1.3 },
        { modelName: 'Market Context', weight: 0.15, contribution: -0.1 },
      ],
    },
    risk: {
      flags: [
        {
          id: 'rf1',
          severity: 'low',
          message: 'Regulatory scrutiny on AI practices ongoing',
        },
      ],
      topDrivers: [
        {
          id: 'd1',
          factor: 'AI Leadership',
          impact: 0.92,
          description: 'Strong positioning in generative AI with Gemini and Bard',
        },
        {
          id: 'd2',
          factor: 'Cloud Growth',
          impact: 0.78,
          description: 'Accelerating GCP revenue growth and market share gains',
        },
        {
          id: 'd3',
          factor: 'Search Dominance',
          impact: 0.65,
          description: 'Continued leadership in search advertising market',
        },
        {
          id: 'd4',
          factor: 'YouTube Performance',
          impact: 0.58,
          description: 'Strong advertiser demand and creator ecosystem growth',
        },
      ],
      confidenceScore: 85.2,
    },
    narrative: {
      stance: 'bullish',
      explanation:
        'Alphabet is well-positioned for growth with strong AI capabilities and cloud momentum. The company\'s leadership in generative AI and accelerating GCP growth provide significant upside catalysts. Search advertising remains resilient while YouTube continues to show strong performance. With a 72.3% probability of price increase, the outlook is solidly positive.',
    },
    recentPrices: [138.2, 139.5, 138.9, 140.2, 141.8, 142.1, 141.5, 143.2, 142.8, 144.5, 145.1, 144.7, 146.3, 147.2, 146.8],
  },
  MSFT: {
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    horizon: '1M',
    generatedAt: new Date().toISOString(),
    forecast: {
      probabilityUp: 65.8,
      expectedReturn: 3.5,
      quantiles: {
        q10: -2.8,
        q50: 3.2,
        q90: 9.8,
      },
      uncertainty: 16.5,
      modelBreakdown: [
        { modelName: 'Technical Analysis', weight: 0.3, contribution: 1.8 },
        { modelName: 'Sentiment Analysis', weight: 0.3, contribution: 1.2 },
        { modelName: 'Fundamental Model', weight: 0.25, contribution: 0.7 },
        { modelName: 'Market Context', weight: 0.15, contribution: -0.2 },
      ],
    },
    risk: {
      flags: [
        {
          id: 'rf1',
          severity: 'medium',
          message: 'Azure growth rate concerns amid competition',
        },
      ],
      topDrivers: [
        {
          id: 'd1',
          factor: 'Azure AI Services',
          impact: 0.88,
          description: 'Strong enterprise adoption of Azure OpenAI services',
        },
        {
          id: 'd2',
          factor: 'Office 365 Copilot',
          impact: 0.75,
          description: 'Growing traction for AI-powered productivity tools',
        },
        {
          id: 'd3',
          factor: 'Gaming Division',
          impact: 0.52,
          description: 'Activision integration progressing well',
        },
      ],
      confidenceScore: 78.5,
    },
    narrative: {
      stance: 'bullish',
      explanation:
        'Microsoft maintains a strong position with Azure AI services driving enterprise adoption. Office 365 Copilot shows promising early traction. While Azure growth faces competitive pressure, the overall cloud and AI strategy remains robust with a 65.8% probability of upward price movement.',
    },
    recentPrices: [368.5, 370.2, 369.8, 372.1, 373.5, 372.9, 375.2, 374.6, 376.8, 377.2, 378.5, 377.9, 380.1, 381.3, 380.7],
  },
};

