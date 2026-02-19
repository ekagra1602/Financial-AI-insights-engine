from twelvedata import TDClient
from database import save_bars_1d, save_bars_1m, fetch_history, get_latest_timestamp
import pandas as pd
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import pytz

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

API_KEY = os.getenv("TWELVE_DATA_API_KEY")

ET = pytz.timezone("America/New_York")

def is_market_open() -> bool:
    """Check if US stock market is currently open (Mon-Fri 9:30 AM - 4:00 PM ET)."""
    now_et = datetime.now(ET)
    # Weekend check
    if now_et.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now_et <= market_close


class DataManager:
    def __init__(self):
        if not API_KEY:
             print("Warning: API_KEY not found in .env")
        self.td = TDClient(apikey=API_KEY)

    def get_stock_data(self, symbol: str, timeframe: str):
        """
        Main entry point.
        timeframe: '1min', '1h', '1day'
        
        Caching rules:
        - If market is OPEN: fetch if data > 2 min old
        - If market is CLOSED: fetch ONLY if we don't have the last market close data
        """
        table_name = "bars_1m" if timeframe == "1min" else ("bars_1h" if timeframe == "1h" else "bars_1d")
        interval = "1min" if timeframe == "1min" else ("1h" if timeframe == "1h" else "1day")
        
        # 1. Check local DB for latest data
        latest_ts = get_latest_timestamp(symbol, table_name)
        
        # 2. Determine if we need to fetch updates
        fetch_needed = False
        start_date = None
        
        if not latest_ts:
            # No data at all — must fetch
            fetch_needed = True
            if interval == "1day":
                 start_date = (datetime.now() - timedelta(days=365*5 + 20)).strftime('%Y-%m-%d')
            elif interval == "1h":
                 start_date = (datetime.now() - timedelta(days=95)).strftime('%Y-%m-%d')
            else:
                 start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        else:
            ts_format = '%Y-%m-%d %H:%M:%S' if interval in ["1min", "1h"] else '%Y-%m-%d'
            # Parse as naive first
            last_dt_naive = datetime.strptime(latest_ts, ts_format)
            # Localize to ET assuming DB stores ET (which TwelveData returns)
            last_dt = ET.localize(last_dt_naive)
            
            now_et = datetime.now(ET)
            
            if is_market_open():
                # Market OPEN: Check 2-min staleness
                diff_seconds = (now_et - last_dt).total_seconds()
                if diff_seconds > 120:
                    fetch_needed = True
                    start_date = latest_ts # Increment logic handled by API start_date usually inclusive? 
                    # TwelveData start_date is inclusive. We can just ask for latest.
                else:
                    print(f"  [OPEN] Data fresh ({int(diff_seconds)}s old). Cache HIT.")
            else:
                # Market CLOSED: Check if we have the last close
                # Last market close is usually today 16:00 or yesterday 16:00
                
                # Find the most recent hypothetical market close time
                cursor = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
                if now_et < cursor:
                    cursor -= timedelta(days=1)
                
                # Roll back weekends to Friday
                while cursor.weekday() >= 5:
                    cursor -= timedelta(days=1)
                
                last_market_close = cursor
                # Exception: Early close days? Ignoring for MVP.
                
                # If our data is OLDER than the last close, we need to fetch
                # Use 2-min tolerance: 1-min bars end at 3:59 PM, not 4:00 PM
                staleness_tolerance = timedelta(minutes=2)
                if last_dt < (last_market_close - staleness_tolerance):
                    print(f"  [CLOSED] Data stale (Last: {last_dt}, Market Close: {last_market_close}). Fetching...")
                    fetch_needed = True
                    start_date = latest_ts
                else:
                    print(f"  [CLOSED] Data complete (Last: {last_dt} ~= Close: {last_market_close}). Cache HIT.")

        if fetch_needed:
            print(f"Fetching {symbol} {interval} from {start_date}...")
            try:
                params = {
                    "symbol": symbol,
                    "interval": interval,
                    "timezone": "America/New_York",
                    "order": "asc",
                    "outputsize": 5000
                }
                if start_date:
                    params["start_date"] = start_date

                ts = self.td.time_series(**params)
                df = ts.as_pandas()
                
                if df is not None and not df.empty:
                     from database import save_bars_1h
                     if interval == "1min":
                        save_bars_1m(symbol, df)
                     elif interval == "1h":
                        save_bars_1h(symbol, df)
                     else:
                        save_bars_1d(symbol, df)
            except Exception as e:
                print(f"Error fetching data: {e}")
        
        return fetch_history(symbol, table_name)

manager = DataManager()
