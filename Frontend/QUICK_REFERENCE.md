# Quick Reference Guide

## 🚀 Start the App

```bash
cd Frontend
npm install
npm run dev
```

Open: **http://localhost:3000**

---

## 📱 What You'll See

### Header
- **Logo**: Qualcomm Financial Engine
- **Nav**: Insights | Chatbot | 🔔 | Account

### Main Content
- **Oracle** stock detail page
- **$243.28** current price
- **-2.83%** daily change
- **Chart** with 8 time periods (1D to MAX)
- **About** with company info
- **Key Statistics** with market metrics

### Sidebar
- **Stock Watchlist** with 10 stocks
- **Mini sparklines** for each stock
- **Collapsible lists**

---

## 🎨 Style Guide

### Colors
- Background: `#0d0e0e` (black)
- Surface: `#1b1c1d` (dark gray)
- Primary: `#c3ff2d` (lime green)
- Negative: `#ff5000` (red/orange)
- Positive: `#00c805` (green)

### Components
- Dark cards with rounded corners
- Smooth hover transitions
- Color-coded price changes
- Responsive grid layout

---

## 📝 Key Changes from Previous Version

| Before | After |
|--------|-------|
| Portfolio view | Stock detail view |
| Robinhood branding | Qualcomm Financial Engine |
| Rewards/Investing/Crypto | Insights/Chatbot |
| Individual account | Oracle stock |
| Win gold button | Advanced button |
| 7 time periods | 8 time periods (added 5Y, MAX) |
| Buying power | Key statistics |

---

## 📂 Important Files

```
src/
├── App.tsx                     # Main layout
├── components/
│   ├── Header.tsx             # Top navigation
│   ├── StockDetailHeader.tsx  # Oracle price display
│   ├── PortfolioChart.tsx     # Chart component
│   ├── StockAbout.tsx         # About section
│   ├── KeyStatistics.tsx      # Statistics grid
│   └── StockWatchlist.tsx     # Sidebar stocks
└── data/
    └── demoData.ts            # featuredStock object
```

---

## 🔧 Common Customizations

### Change Featured Stock
**File**: `src/data/demoData.ts`
```typescript
export const featuredStock = {
  symbol: 'AAPL',        // ← Change this
  companyName: 'Apple',  // ← And this
  price: 271.29,         // ← And this
  // ... etc
}
```

### Change App Name
**File**: `src/components/Header.tsx`
```typescript
<div className="text-text-primary font-semibold text-lg">
  Your App Name  // ← Change this
</div>
```

### Add Navigation Item
**File**: `src/components/Header.tsx`
```typescript
<a href="#" className="flex items-center gap-2...">
  <YourIcon className="w-5 h-5" />
  <span>Your Link</span>
</a>
```

### Change Colors
**File**: `tailwind.config.js`
```javascript
colors: {
  primary: '#your-color',  // ← Change these
}
```

---

## 🎯 Features at a Glance

✅ Stock detail view (Oracle)  
✅ Real-time price tracking  
✅ Interactive charts  
✅ Company information  
✅ Market statistics  
✅ Stock watchlist  
✅ Sparkline charts  
✅ Dark theme  
✅ Fully responsive  
✅ AI-ready nav  

---

## 📊 Demo Data Included

- **Featured Stock**: Oracle (ORCL)
- **Watchlist**: 10 stocks (META, ORCL, SPX, etc.)
- **Chart Data**: All time periods
- **Company Info**: CEO, employees, HQ, founded
- **Statistics**: 10 key metrics

---

## 🐛 Troubleshooting

### Port 3000 in use?
```bash
lsof -ti:3000 | xargs kill -9
```

### Dependencies not installing?
```bash
rm -rf node_modules package-lock.json
npm install
```

### Changes not showing?
- Hard refresh: `Cmd/Ctrl + Shift + R`
- Clear cache
- Restart dev server

---

## 📚 More Help

- **Full docs**: `README.md`
- **Quick start**: `QUICKSTART.md`
- **Install guide**: `INSTALL.md`
- **Changes**: `CHANGELOG.md`
- **Update details**: `UPDATE_SUMMARY.md`

---

## ⚡ Quick Commands

```bash
# Install
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

**That's it! You're ready to go!** 🎉

