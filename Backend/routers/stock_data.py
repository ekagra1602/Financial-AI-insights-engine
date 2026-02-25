from fastapi import APIRouter
from services.stock_manager import manager
from datetime import datetime, timedelta
import pandas as pd

router = APIRouter()

@router.get("/history/{symbol}", tags=["Stock Data"])
def get_history(symbol: str, timeframe: str = "1D"):
    """
    timeframe: 1D, 5D, 1M, 3M, 1Y, 5Y
    """
    symbol = symbol.upper()
    
    # Logic for timeframes
    # 1D: 1min data, last 1 day
    # 5D: 1h data, last 5 days
    # 1M: 1h data, last 30 days
    # 3M: 1h data, last 90 days
    # 1Y: 1d data, last 1 year
    # 5Y: 1d data (resampled to 1W), last 5 years

    df = pd.DataFrame()

    try:
        print(f"DEBUG: Processing {symbol} timeframe={timeframe}")
        if timeframe == "1D":
            # 1min data, last 24 hours
            df = manager.get_stock_data(symbol, "1min")
            if not df.empty and 'datetime' in df.columns:
                df['dt'] = pd.to_datetime(df['datetime'])
                cutoff = datetime.now() - timedelta(hours=24)
                df = df[df['dt'] >= cutoff]
                
        elif timeframe == "5D":
            # 1h data, find last 5 unique trading dates
            df = manager.get_stock_data(symbol, "1h")
            if not df.empty and 'datetime' in df.columns:
                df['dt'] = pd.to_datetime(df['datetime'])
                # Sort descending to find recent dates
                df = df.sort_values('dt', ascending=False)
                # Extract date part
                df['date_only'] = df['dt'].dt.date
                unique_dates = df['date_only'].unique()
                
                # Take last 5 dates
                if len(unique_dates) > 5:
                    cutoff_date = unique_dates[4] # 5th date
                    df = df[df['date_only'] >= cutoff_date]
                
                # Sort back ascending for graph
                df = df.sort_values('dt', ascending=True)
    
        elif timeframe in ["1M", "3M"]:
             # 1h data, last 1 or 3 months
             df = manager.get_stock_data(symbol, "1h")
             if not df.empty and 'datetime' in df.columns:
                 df['dt'] = pd.to_datetime(df['datetime'])
                 days = 30 if timeframe == "1M" else 90
                 # For 3M, we might want 1d data if 1h is too much point, but user logic used 1h for intraday-ish feel?
                 # Actually StockGraph used 1h for 1M/3M.
                 cutoff = datetime.now() - timedelta(days=days)
                 df = df[df['dt'] >= cutoff]
    
        elif timeframe == "5Y":
             # Weekly data, resampled from Daily
             df = manager.get_stock_data(symbol, "1day")
             if not df.empty and 'date' in df.columns:
                 df['dt'] = pd.to_datetime(df['date'])
                 cutoff = datetime.now() - timedelta(days=365*5)
                 df = df[df['dt'] >= cutoff]
                 
                 # Resample to 1 Week ('W')
                 df.set_index('dt', inplace=True)
                 
                 agg_dict = {
                     col: 'first' if col == 'open' else 
                          'max' if col == 'high' else 
                          'min' if col == 'low' else 
                          'last' if col == 'close' else 
                          'sum' if col == 'volume' else 'first'
                     for col in df.columns if col not in ['datetime', 'symbol', 'date', 'dt']
                 }
                 # Filter only existing columns
                 agg_dict = {k:v for k,v in agg_dict.items() if k in df.columns}
                 
                 if not df.empty:
                    df_resampled = df.resample('W-FRI').agg(agg_dict).dropna()
                    df_resampled['date'] = df_resampled.index.strftime('%Y-%m-%d')
                    df_resampled['symbol'] = symbol
                    df = df_resampled.reset_index()
    
        else:
            # 1Y -> Daily data
            print("DEBUG: Fetching 1day data...")
            df = manager.get_stock_data(symbol, "1day")
            print(f"DEBUG: Fetched {len(df)} rows. Columns: {df.columns}")
            if not df.empty and 'date' in df.columns:
                 df['dt'] = pd.to_datetime(df['date'])
                 cutoff = datetime.now() - timedelta(days=365)
                 print(f"DEBUG: Cutoff date: {cutoff}")
                 df = df[df['dt'] >= cutoff]
                 print(f"DEBUG: After filter: {len(df)} rows")

    except Exception as e:
        print(f"Error getting history: {e}")
        return {"symbol": symbol, "data": []}

    if df.empty:
        return {"symbol": symbol, "data": []}
        
    # Standardize time column
    if 'datetime' in df.columns:
         df['time'] = df['datetime']
    elif 'date' in df.columns:
         df['time'] = df['date']
         
    # Return list of dicts
    data = df.to_dict(orient="records")
    return {"symbol": symbol, "data": data}
