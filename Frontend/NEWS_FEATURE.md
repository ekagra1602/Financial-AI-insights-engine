# News Summarization & Related Articles Feature

This document describes the implementation of the News Summarization and Related Articles feature for the Qualcomm Financial Insights Engine.

## Feature Overview

The News Summarization feature allows users to:

1. View summarized news for selected stock tickers
2. See sentiment and tone indicators at a glance
3. Explore related news stories through vector-based recommendations

## Implementation Details

### Routes

The feature is accessible through the `/news/:ticker` route, where `:ticker` is the stock symbol (e.g., AAPL, MSFT, TSLA).

### Components Structure

1. **NewsPage**: Main container component that handles:

   - Fetching news for a specific ticker
   - Managing the state of related articles drawer
   - Handling refresh functionality

2. **NewsCard**: Displays a single news article summary with:

   - Headline (clickable link to original article)
   - Source and published time
   - LLM-generated summary
   - Sentiment and tone indicators (positive/negative/neutral, bullish/bearish)
   - Keywords as tags
   - Button to show related articles

3. **RelatedArticles**: Slide-in drawer showing related articles:
   - Article headline
   - Source and published time
   - Sentiment indicator
   - Relation context explaining why articles are related

### Data Flow

Currently, the application uses mock data from `src/data/newsData.ts` to simulate:

1. News articles for different tickers
2. Related articles for each news item

In a production environment, this would be replaced with API calls to:

- `/api/news?ticker=SYMBOL` to fetch summarized news
- `/api/related?article_id=ID` to fetch related articles

### User Interface States

The UI handles multiple states:

- **Loading**: Shows skeleton loaders while fetching data
- **Error**: Displays error message with retry option
- **Empty**: Shows message when no news is available for a ticker
- **Success**: Displays list of news cards

## Demo Data

For demonstration purposes, the feature includes demo data for:

- Apple (AAPL)
- Tesla (TSLA)
- Microsoft (MSFT)
- Oracle (ORCL)

Each article includes realistic metadata like source, publish time, sentiment analysis, and keywords.

## Future Enhancements

1. Implement real API integration when backend is available
2. Add pagination or infinite scroll for large news feeds
3. Implement keyword search and filtering
4. Add notification for breaking news
5. Create user preferences for news topics/sources

## Usage

To access the feature, users can:

1. Navigate to `/news/AAPL` (or any supported ticker)
2. Use the navigation menu's "News" dropdown
3. Click refresh to fetch the latest news
4. Click "Show Related Articles" on any news card to view semantically similar stories
