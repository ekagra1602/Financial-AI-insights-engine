import React, { useState, useEffect } from 'react';
import { StockChart } from '../components/StockChart';
import { Search, X, Star, Plus, Check } from 'lucide-react';
import { searchStocks, getWatchlist, addToWatchlist, removeFromWatchlist, fetchKeyStatistics } from '../services/api';
import { StockSymbol, WatchlistItem } from '../types';
import { clsx } from 'clsx';
import { CompanyStats } from '../components/CompanyStats';

const DEFAULT_WATCHLIST = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'QCOM', name: 'Qualcomm Incorporated' },
];

const HomePage: React.FC = () => {
    const [symbol, setSymbol] = useState('QCOM');
    const [companyName, setCompanyName] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StockSymbol[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

    // Watchlist State
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loadingWatchlist, setLoadingWatchlist] = useState(false);

    const loadWatchlist = async () => {
        setLoadingWatchlist(true);
        try {
            const data = await getWatchlist();
            setWatchlist(data);
        } catch (e) {
            console.error("Failed to load watchlist", e);
        } finally {
            setLoadingWatchlist(false);
        }
    };

    // Seed default stocks if watchlist is empty
    const seedDefaultWatchlist = async () => {
        try {
            const data = await getWatchlist();
            if (data.length === 0) {
                await Promise.all(
                    DEFAULT_WATCHLIST.map(s => addToWatchlist(s.symbol, s.name))
                );
                await loadWatchlist();
            } else {
                setWatchlist(data);
            }
        } catch (e) {
            console.error("Failed to seed watchlist", e);
        }
    };

    useEffect(() => {
        seedDefaultWatchlist();
    }, []);

    // Fetch company name whenever symbol changes
    useEffect(() => {
        setCompanyName('');
        fetchKeyStatistics(symbol)
            .then(stats => setCompanyName(stats.name || ''))
            .catch(() => setCompanyName(''));
    }, [symbol]);

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                performSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const performSearch = async (query: string) => {
        setIsSearching(true);
        try {
            const results = await searchStocks(query);
            setSearchResults(results.result || []);
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            performSearch(searchQuery);
        }
    };

    const handleSelectSymbol = (newSymbol: string) => {
        setSymbol(newSymbol);
        setSearchQuery('');
        setSearchResults([]);
    };

    const isInWatchlist = watchlist.some(item => item.symbol === symbol);

    const handleToggleWatchlist = async () => {
        if (isInWatchlist) {
            await removeFromWatchlist(symbol);
        } else {
            await addToWatchlist(symbol, companyName || symbol);
        }
        await loadWatchlist();
    };

    const handleAddToWatchlist = async (item: StockSymbol) => {
        await addToWatchlist(item.symbol, item.description || item.symbol);
        setAddedSymbols(prev => new Set(prev).add(item.symbol));
        await loadWatchlist();
        setTimeout(() => {
            setAddedSymbols(prev => { const s = new Set(prev); s.delete(item.symbol); return s; });
        }, 2000);
    };

    return (
        <div className="flex h-[calc(100vh-64px)] p-6 gap-6">
            {/* Left: Stock Graph (2/3 width) */}
            <div className="w-2/3 h-full flex flex-col gap-6 overflow-y-auto pr-2">
                <div className="w-full min-h-[500px]">
                    <StockChart
                        symbol={symbol}
                        companyName={companyName}
                        isInWatchlist={isInWatchlist}
                        onToggleWatchlist={handleToggleWatchlist}
                    />
                </div>
                <CompanyStats symbol={symbol} />
            </div>

            {/* Right: Search & List (1/3 width) */}
            <div className="w-1/3 bg-surface rounded-xl border border-border p-4 flex flex-col h-full shadow-lg">
                <div className="mb-4">
                    <h2 className="text-xl font-bold mb-4 text-text-primary px-1">
                        {searchQuery ? "Search Results" : "Your Watchlist"}
                    </h2>

                    <form onSubmit={handleSearchSubmit} className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search ticker (e.g. NVDA)..."
                            className="w-full bg-background border border-border rounded-lg py-2 pl-4 pr-10 text-text-primary focus:outline-none focus:border-primary transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary">
                            <Search className="w-5 h-5" />
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {searchQuery ? (
                        isSearching ? (
                            <div className="text-center text-text-secondary py-4">Searching...</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {searchResults.map((item) => {
                                    const alreadyInWatchlist = watchlist.some(w => w.symbol === item.symbol);
                                    const justAdded = addedSymbols.has(item.symbol);
                                    return (
                                        <div
                                            key={item.symbol}
                                            className="flex justify-between items-center p-3 hover:bg-surface-light rounded-lg transition-colors group cursor-pointer"
                                            onClick={() => handleSelectSymbol(item.symbol)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-text-primary">{item.displaySymbol}</div>
                                                <div className="text-xs text-text-secondary truncate max-w-[180px]">{item.description}</div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                                <span className="text-xs text-text-secondary">{item.type}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(item); }}
                                                    disabled={alreadyInWatchlist || justAdded}
                                                    title={alreadyInWatchlist ? "Already in watchlist" : "Add to watchlist"}
                                                    className={clsx(
                                                        "p-1 rounded-full transition-colors flex-shrink-0",
                                                        alreadyInWatchlist || justAdded
                                                            ? "text-positive cursor-default"
                                                            : "text-text-secondary hover:text-primary hover:bg-primary/10"
                                                    )}
                                                >
                                                    {alreadyInWatchlist || justAdded
                                                        ? <Check className="w-4 h-4" />
                                                        : <Plus className="w-4 h-4" />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {searchResults.length === 0 && !isSearching && (
                                    <div className="text-center text-text-secondary py-4">No results found</div>
                                )}
                            </div>
                        )
                    ) : (
                        // Watchlist UI
                        <div className="flex flex-col gap-2">
                            {watchlist.map((item) => (
                                <div
                                    key={item.symbol}
                                    onClick={() => handleSelectSymbol(item.symbol)}
                                    className="flex justify-between items-center p-3 hover:bg-surface-light rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-border/50"
                                >
                                    <div>
                                        <div className="font-bold text-text-primary flex items-center gap-2">
                                            {item.symbol}
                                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                        </div>
                                        <div className="text-xs text-text-secondary">{item.name}</div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className="flex flex-col items-end">
                                            <div className="font-medium text-text-primary">
                                                ${item.price?.toFixed(2) || '-.--'}
                                            </div>
                                            <div className={clsx("text-xs", (item.change || 0) >= 0 ? "text-positive" : "text-negative")}>
                                                {(item.change || 0) > 0 ? '+' : ''}{(item.change || 0).toFixed(2)}%
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromWatchlist(item.symbol).then(loadWatchlist);
                                            }}
                                            className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors text-text-secondary"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {watchlist.length === 0 && !loadingWatchlist && (
                                <div className="text-center text-text-secondary py-8 flex flex-col items-center">
                                    <Star className="w-8 h-8 mb-2 opacity-20" />
                                    <p>Your watchlist is empty</p>
                                    <p className="text-xs mt-1">Search for a stock to add it</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomePage;
