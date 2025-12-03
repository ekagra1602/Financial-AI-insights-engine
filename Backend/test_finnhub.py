import requests
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FINNHUB_API_KEY")
print(f"Using API Key: {api_key[:5]}...")

url = "https://finnhub.io/api/v1/stock/candle"
params = {
    "symbol": "AAPL",
    "resolution": "D",
    "from": 1590988249,
    "to": 1591852249,
    "token": api_key
}

response = requests.get(url, params=params)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
