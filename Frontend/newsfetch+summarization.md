# 🧠 **Frontend Description: News Summarization & Related Articles Feature**

### **Purpose**

Provide an interactive, responsive page (or component) where users can:

1. View summarized news for selected tickers.
2. See sentiment and tone indicators at a glance.
3. Explore similar or related news stories through vector-based recommendations.

---

## **1️⃣ Entry Point / Endpoint**

**Endpoint:** `/news/:ticker`
Example: `/news/AAPL`

This page displays **all summarized news articles** related to a selected company ticker (e.g., AAPL).

---

## **2️⃣ Layout Overview**

The page is divided into three key sections:

### **A. Header Section**

- **Ticker Header:**
  Displays the selected ticker (e.g., `AAPL`) and company name (`Apple Inc.`).
- **Last Updated Info:**
  Small text showing when the feed was last refreshed (e.g., “Updated 20 mins ago”).
- **Refresh Button:**
  Allows the user to manually re-fetch the latest summaries.

---

### **B. News Feed Section (Main Content)**

Displays a **scrollable list of summarized articles**.

Each **NewsCard** component includes:

- **Headline:** Clickable link opening the full article in a new tab.
- **Published Time:** Relative time (e.g., “2 hours ago”).
- **Source:** Publisher name (e.g., Reuters, Bloomberg).
- **Summary:** LLM-generated summary text (1–2 lines).
- **Sentiment Badge:**

  - Green = Positive
  - Red = Negative
  - Grey = Neutral

- **Tone Label:** e.g., “Bullish”, “Bearish”, or “Neutral”.
- **Keywords/Tags:**
  Small badges for major extracted topics like `iPhone16`, `China`, `TimCook`.

**Interaction:**

- When the user **clicks** on a NewsCard → Opens a **Right Drawer Modal** showing:

  - Full LLM summary
  - Keywords (clickable for search)
  - Button: “Show Related Articles”

---

### **C. Related Articles Drawer (Right Panel or Modal)**

When the user clicks “Show Related Articles”:

- The UI fetches `/api/related?article_id=<id>`
- Displays **Top 5 semantically similar articles**, shown as compact cards:

  - Headline + Source
  - Sentiment/Tone tags
  - Published Time

- Option: “View Full Article” (opens in new tab)

**Bonus:**
Add a small visual cue like “🔗 Related to: iPhone 16 launch”.

---

## **3️⃣ UI Interactions and States**

| State            | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| **Loading**      | Show skeleton cards or “Fetching latest news…” spinner.      |
| **No Data**      | Show message like “No news articles available for AAPL yet.” |
| **Error**        | Display retry button if API call fails.                      |
| **Auto-refresh** | Background refresh every X minutes (optional).               |

---

## **4️⃣ API Integrations**

| API                           | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `/api/news?ticker=AAPL`       | Returns summarized news list for ticker                           |
| `/api/related?article_id=123` | Returns related/similar articles                                  |
| `/api/watchlist`              | Optional — lets users manage their watchlist (Add/Remove tickers) |

---

## **5️⃣ Component Hierarchy**

```
NewsPage
 ├── Header (Ticker + Refresh Button)
 ├── NewsFeed
 │     ├── NewsCard (repeated for each article)
 │     └── EmptyState / LoadingState
 ├── RelatedDrawer (opens when user clicks "Show Related")
 └── Footer / Pagination Controls (optional)
```

---

## **6️⃣ Frontend Behavior Summary**

- User navigates to `/news/:ticker`
- Frontend calls `/api/news?ticker=<symbol>` to get summarized news.
- Displays cards with title, summary, tone, sentiment, and tags.
- User clicks “Show Related Articles” → triggers `/api/related?article_id=<id>`.
- Related articles appear in a right-side panel or modal.
- User can click keywords to perform filtered searches or open new tickers.

---

## **7️⃣ Visual Example (Conceptual Wireframe)**

```
----------------------------------------------------
|  AAPL  (Apple Inc.)             ⟳ Refresh        |
|  Updated 15 mins ago                              |
----------------------------------------------------
| 📰  Apple launches iPhone 16                      |
|     "Apple unveiled its new AI camera feature..." |
|     Source: Reuters | 2h ago                     |
|     Sentiment: 😊 Positive | Tone: Bullish        |
|     Keywords: iPhone16, AI, TimCook              |
|     [Show Related Articles]                      |
----------------------------------------------------
| 📰  Apple Stock Rises 2% After Earnings Beat      |
|     "Q3 profits surpassed Wall Street estimates." |
|     Source: Bloomberg | 3h ago                   |
|     Sentiment: 🟢 Positive | Tone: Bullish        |
|     Keywords: Earnings, Q3, Revenue              |
|     [Show Related Articles]                      |
----------------------------------------------------
```

Clicking “Show Related Articles” opens a side panel:

```
--------------------------------------
| Related to: iPhone 16 launch       |
--------------------------------------
| Tesla integrates Apple AI tools... |
|  Published: 1h ago | Sentiment: 👍  |
--------------------------------------
| Rivian follows Apple’s supply move |
|  Published: 2h ago | Sentiment: 🟠  |
--------------------------------------
```
