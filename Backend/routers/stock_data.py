from fastapi import APIRouter
from services.chart_events import compute_price_events
from services.history_loader import load_chart_history_records

router = APIRouter()


@router.get("/history/{symbol}", tags=["Stock Data"])
def get_history(symbol: str, timeframe: str = "1D"):
    """
    timeframe: 1D, 5D, 1M, 3M, 1Y, 5Y
    """
    symbol = symbol.upper()
    data = load_chart_history_records(symbol, timeframe)
    if not data:
        return {"symbol": symbol, "data": [], "events": []}
    events = compute_price_events(data, timeframe)
    return {"symbol": symbol, "data": data, "events": events}
