# News Feature Improvements

## Changes Made

### 1. Navigation Bar

- Fixed the navigation bar to always be visible at the top of the page
- Improved styling and layout to make it clearer
- Added highlight for active navigation item
- Ensured dashboard link is always visible for easy return to home

### 2. News Page Redesign

- Combined news from all watchlist companies into a single feed
- Added company ticker badge to each news card for easy identification
- News is sorted by recency (most recent first)
- Added filter panel on the right side to select specific companies

### 3. Improved Button Styling

- Enhanced button contrast for better visibility
- Added darker primary color shade for better text readability
- Improved hover states and visual hierarchy
- Added subtle shadows for better depth

### 4. Layout Structure

- Created a consistent root layout that wraps all pages
- Added proper routing with React Router
- Ensured header consistency across all pages
- Made the layout responsive for different screen sizes

### 5. Component Organization

- Separated the news component logic for better maintainability
- Created specialized filter panel for watchlist companies
- Improved related articles drawer with better styling
- Added new loading states and error handling

## New Features

### Watchlist Filter

The right sidebar now includes a company filter that allows users to:

- Select specific companies to show news for
- See their current price changes while selecting
- Select all or clear all companies with a single click
- Apply filters to update the news feed

### Mixed News Feed

Instead of separate tabs for each company, the news feed now:

- Shows combined news from all watchlist companies by default
- Displays a company ticker badge on each news item
- Sorts by recency automatically
- Has improved card design with clearer information hierarchy

### Navigation Improvements

The new navigation allows:

- Quick access to the dashboard at any time
- Direct navigation to the news page
- Clear indication of the current page
- Better mobile experience

### Visual Improvements

- Better button contrast for "Show Related Articles" and other actions
- Improved color scheme that maintains brand identity while ensuring readability
- Consistent styling across all components
- Better information hierarchy
