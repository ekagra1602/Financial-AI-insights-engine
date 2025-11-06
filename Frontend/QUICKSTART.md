# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
cd Frontend
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Open in Browser
Visit `http://localhost:3000` in your browser

---

## 📦 What's Included

This financial dashboard includes:
- ✅ Real-time portfolio tracking with interactive charts
- ✅ Stock watchlist with mini sparkline charts
- ✅ Financial news feed
- ✅ Daily market movers
- ✅ Dark theme UI matching Robinhood style
- ✅ Fully responsive design
- ✅ Demo data for immediate testing

---

## 🎯 Key Features to Try

1. **Time Period Selection**: Click on 1D, 1W, 1M, 3M, YTD, 1Y, or ALL buttons to view portfolio performance over different periods

2. **Stock Watchlist**: Scroll through the stock list on the right sidebar to see:
   - Real-time price changes (demo data)
   - Mini sparkline charts showing trends
   - Color-coded gains (green) and losses (red)

3. **News Feed**: Browse the latest financial news with stock tickers and price changes

4. **Daily Movers**: See which stocks made the biggest moves today

---

## 🛠️ Tech Stack

- **React 18** - Modern UI library
- **TypeScript** - Type safety
- **Vite** - Lightning-fast dev server
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Beautiful charts
- **Lucide Icons** - Icon library

---

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- 💻 Desktop (1920px+)
- 💻 Laptop (1280px+)
- 📱 Tablet (768px+)
- 📱 Mobile (375px+)

---

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js` to customize the color scheme.

### Update Demo Data
Edit `src/data/demoData.ts` to change:
- Stock prices and symbols
- Portfolio values
- News articles
- Daily movers

### Add New Components
Create new components in `src/components/` and import them in `App.tsx`.

---

## 🔧 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📂 Project Structure

```
Frontend/
├── src/
│   ├── components/      # React components
│   ├── data/           # Demo data
│   ├── types.ts        # TypeScript types
│   ├── App.tsx         # Main app
│   └── main.tsx        # Entry point
├── public/             # Static assets
└── package.json        # Dependencies
```

---

## 🐛 Troubleshooting

**Port 3000 already in use?**
- Change the port in `vite.config.ts`

**Dependencies not installing?**
- Try `npm install --legacy-peer-deps`

**Build errors?**
- Make sure you're using Node.js 16 or higher
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

---

## 📚 Next Steps

1. **Integrate Real Data**: Replace demo data with real API calls
2. **Add Authentication**: Implement user login/signup
3. **Enhance Charts**: Add more technical indicators
4. **Add Features**: Watchlist management, price alerts, etc.

---

## 💡 Tips

- Press `Ctrl+C` to stop the development server
- Changes auto-reload in the browser (Hot Module Replacement)
- Check the browser console for any errors
- Use React DevTools for debugging

---

Enjoy building your financial dashboard! 🎉

