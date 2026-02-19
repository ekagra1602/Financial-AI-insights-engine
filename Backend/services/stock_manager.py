from twelvedata import TDClient
from database import save_bars_1d, save_bars_1m, fetch_history, get_latest_timestamp
import pandas as pd
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

API_KEY = os.getenv("TWELVE_DATA_API_KEY")

class DataManager:
    def __init__(self):
        if not API_KEY:
             print("Warning: API_KEY not found in .env")
        self.td = TDClient(apikey=API_KEY)

    def get_stock_data(self, symbol: str, timeframe: str):
        """
        Main entry point.
        timeframe: '1min', '1h', '1day'
        """
        table_name = "bars_1m" if timeframe == "1min" else ("bars_1h" if timeframe == "1h" else "bars_1d")
        interval = "1min" if timeframe == "1min" else ("1h" if timeframe == "1h" else "1day")
        
        # 1. Check local DB for latest data
        latest_ts = get_latest_timestamp(symbol, table_name)
        
        # 2. Determine if we need to fetch updates
        fetch_needed = False
        start_date = None
        
        if not latest_ts:
            fetch_needed = True
            if interval == "1day":
                 start_date = (datetime.now() - timedelta(days=365*5 + 20)).strftime('%Y-%m-%d')
            elif interval == "1h":
                 # 3 months of 1h data
                 start_date = (datetime.now() - timedelta(days=95)).strftime('%Y-%m-%d')
            else:
                 # 1min
                 start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        else:
            ts_format = '%Y-%m-%d %H:%M:%S' if interval in ["1min", "1h"] else '%Y-%m-%d'
            last_dt = datetime.strptime(latest_ts, ts_format)
            now = datetime.now()
            
            if interval in ["1min", "1h"]:
                diff = (now - last_dt).total_seconds()
                threshold = 300 if interval == "1min" else 3600 # 5min or 1hour
                if diff > threshold:
                    fetch_needed = True
                    start_date = latest_ts
            else:
                 if last_dt.date() < now.date():
                     fetch_needed = True
                     start_date = (last_dt + timedelta(days=1)).strftime('%Y-%m-%d')

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
