from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.financial_data_service import FinancialDataService

router = APIRouter()
financial_data_service = FinancialDataService()


@router.post("/sentiment/ingest/{ticker}", tags=["Sentiment"])
async def ingest_financial_data(
    ticker: str,
    period_type: str = Query(default="quarterly", description="'quarterly' or 'annual'"),
    num_periods: int = Query(default=4, ge=1, le=12, description="Number of periods to ingest (1–12)"),
):
    """
    Trigger financial data ingestion for a ticker.
    Fetches quarterly/annual financials from Finnhub, normalizes, and stores in Supabase.
    Uses POST because this endpoint writes to the database.
    """
    ticker = ticker.upper()

    if period_type not in ("quarterly", "annual"):
        raise HTTPException(status_code=400, detail="period_type must be 'quarterly' or 'annual'")

    try:
        result = financial_data_service.ingest_ticker(
            ticker=ticker,
            period_type=period_type,
            num_periods=num_periods,
        )
        if result["status"] == "error":
            raise HTTPException(status_code=502, detail=f"Ingestion failed for {ticker}: {result['errors']}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/data/{ticker}", tags=["Sentiment"])
async def get_financial_data(
    ticker: str,
    period_type: Optional[str] = Query(default=None, description="Filter by 'quarterly' or 'annual'. Omit for both."),
    limit: int = Query(default=8, ge=1, le=20, description="Max rows to return"),
):
    """
    Retrieve stored financial metadata rows for a ticker from Supabase.
    Returns rows sorted by period_end_date descending.
    Each row includes financials, key_metrics, eps_data, and llm_input.
    """
    ticker = ticker.upper()

    if period_type and period_type not in ("quarterly", "annual"):
        raise HTTPException(status_code=400, detail="period_type must be 'quarterly' or 'annual'")

    try:
        data = financial_data_service.get_ticker_data(ticker=ticker, period_type=period_type, limit=limit)
        return {"ticker": ticker, "count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/llm-input/{ticker}", tags=["Sentiment"])
async def get_llm_input(
    ticker: str,
    period_type: str = Query(default="quarterly", description="'quarterly' or 'annual'"),
):
    """
    Returns the structured LLM input JSON for the most recent stored period.
    This is the primary output consumed by Sprint 8/9 sentiment generation.
    Returns 404 if no data has been ingested yet for this ticker.
    """
    ticker = ticker.upper()

    try:
        llm_input = financial_data_service.get_latest_llm_input(ticker=ticker, period_type=period_type)
        if not llm_input:
            raise HTTPException(
                status_code=404,
                detail=f"No financial data found for {ticker}. Call POST /api/v1/sentiment/ingest/{ticker} first."
            )
        return llm_input
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
