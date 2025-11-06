# Installation Instructions

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** version 16.0 or higher
- **npm** (comes with Node.js) or **yarn**
- A modern web browser (Chrome, Firefox, Safari, or Edge)

## Step-by-Step Installation

### 1. Navigate to the Frontend Directory

```bash
cd Frontend
```

### 2. Install Dependencies

Using npm (recommended):
```bash
npm install
```

Or using yarn:
```bash
yarn install
```

This will install all required dependencies including:
- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3
- Recharts 2
- Lucide Icons
- And all development dependencies

### 3. Start the Development Server

Using npm:
```bash
npm run dev
```

Or using yarn:
```bash
yarn dev
```

### 4. Open in Browser

The development server will start and you should see output similar to:

```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

Open your browser and navigate to: **http://localhost:3000**

## Verification

You should see the financial dashboard with:
- ✅ Portfolio header showing $1,242.37 value
- ✅ Interactive chart with time period selectors
- ✅ Stock watchlist on the right sidebar
- ✅ News feed and daily movers sections

## Building for Production

To create a production build:

```bash
npm run build
```

The optimized files will be in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can:

1. **Kill the process using port 3000:**
   ```bash
   # On macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # On Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **Or change the port in `vite.config.ts`:**
   ```typescript
   export default defineConfig({
     plugins: [react()],
     server: {
       port: 3001, // Change to any available port
     },
   })
   ```

### Installation Errors

If you encounter peer dependency issues:

```bash
npm install --legacy-peer-deps
```

### Node Version Issues

Check your Node.js version:
```bash
node --version
```

If it's below 16.0, update Node.js:
- Download from [nodejs.org](https://nodejs.org/)
- Or use [nvm](https://github.com/nvm-sh/nvm)

### Module Not Found Errors

Clear cache and reinstall:

```bash
# Remove existing installations
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### TypeScript Errors

Ensure TypeScript is properly installed:

```bash
npm install -D typescript
```

### Build Errors

If the build fails:

1. Check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

2. Check for ESLint issues:
   ```bash
   npx eslint src/
   ```

## Environment Variables

Currently, the app uses demo data and doesn't require environment variables. When you integrate with real APIs, create a `.env` file:

```bash
# .env
VITE_API_URL=your_api_url
VITE_API_KEY=your_api_key
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Development Tips

### Hot Module Replacement (HMR)
Changes to your code will automatically reload in the browser without losing state.

### React DevTools
Install the React DevTools browser extension for debugging:
- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### TypeScript Errors in IDE
If you see TypeScript errors in your IDE:
1. Restart your IDE
2. Run `npm install` again
3. Check that your IDE is using the workspace TypeScript version

## Next Steps

After successful installation:

1. **Explore the Dashboard**: Navigate through different time periods, check stock lists
2. **Customize Demo Data**: Edit `src/data/demoData.ts`
3. **Modify Components**: Update components in `src/components/`
4. **Change Styling**: Adjust colors in `tailwind.config.js`
5. **Add New Features**: Build on the existing codebase

## System Requirements

- **Disk Space**: ~200MB for node_modules
- **RAM**: 2GB minimum, 4GB recommended
- **Browser**: Modern browser with JavaScript enabled
- **Operating System**: Windows 10+, macOS 10.14+, or Linux

## Support

For issues or questions:
1. Check the [QUICKSTART.md](QUICKSTART.md)
2. Read the [README.md](README.md)
3. Check the browser console for errors
4. Contact the development team

---

Happy coding! 🚀

