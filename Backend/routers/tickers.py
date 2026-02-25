from fastapi import APIRouter
import json
import os

router = APIRouter()

COMPANY_TICKERS_FILE = os.path.join(os.path.dirname(__file__), "..", "company_tickers.json")

@router.get("/companies")
def get_companies():
    """
    Returns a list of companies from the local JSON file.
    """
    if not os.path.exists(COMPANY_TICKERS_FILE):
        return []
        
    try:
        with open(COMPANY_TICKERS_FILE, "r") as f:
            data = json.load(f)
            
        companies = []
        # The file structure is {"0": {...}, "1": {...}}
        for key, value in data.items():
            companies.append({
                "ticker": value.get("ticker"),
                "title": value.get("title"),
                "cik_str": value.get("cik_str")
            })
            
        # Sort by title for easier user selection, or ticker? usually ticker is primary key but title is better for search
        companies.sort(key=lambda x: x["ticker"])
        return companies
    except Exception as e:
        print(f"Error reading tickers file: {e}")
        return []
