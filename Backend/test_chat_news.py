import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_chat_news(message, ticker=None, include_news=True):
    print(f"\n--- Testing: {message} ---")
    payload = {
        "message": message,
        "ticker": ticker,
        "include_news": include_news
    }
    try:
        response = requests.post(f"{BASE_URL}/api/v1/chat", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"Source: {data.get('source')}")
            print(f"Ticker: {data.get('ticker')}")
            print("-" * 20)
            print(data.get('response'))
            print("-" * 20)
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    # Test cases
    test_chat_news("What's the latest market news?")
    test_chat_news("Tell me the news about AAPL")
    test_chat_news("What happened with Microsoft today?")
    test_chat_news("Explain like I'm 5 the news for TSLA", include_news=True)
    test_chat_news("What's happening with CrowdStrike today?")
    test_chat_news("Give me news for the maker of the iPhone")
    test_chat_news("What's the outlook for Broadcom?")
    test_chat_news("How is Walmart performing?")
    test_chat_news("What's the latest on Disney?")
    test_chat_news("Any updates for JPMorgan today?")
