import os
from dotenv import load_dotenv
import requests

load_dotenv()
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

def get_finnhub_search(query: str):
    url = f"{FINNHUB_BASE_URL}/search"
    params = {"q": query, "token": FINNHUB_API_KEY}
    response = requests.get(url, params=params)
    return response.json()

queries = ["apple", "Apple", "APPLE", "Microsoft", "Broadcom", "Alphabet", "Google"]
for q in queries:
    res = get_finnhub_search(q)
    print(f"\nQuery: {q}")
    if res.get("result"):
        for r in res["result"][:3]:
            print(f"  {r.get('symbol')} - {r.get('description')} ({r.get('type')})")
    else:
        print("  No results")
