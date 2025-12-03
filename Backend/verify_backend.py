import requests
import sys

BASE_URL = "http://127.0.0.1:8001/api/v1"

def test_backend():
    # 1. Register
    email = "test@example.com"
    password = "password123"
    print(f"Registering user {email}...")
    response = requests.post(f"{BASE_URL}/auth/register", json={"email": email, "password": password})
    if response.status_code == 200:
        print("Registration successful")
    elif response.status_code == 400 and "already registered" in response.text:
        print("User already registered, proceeding...")
    else:
        print(f"Registration failed: {response.text}")
        sys.exit(1)

    # 2. Login
    print("Logging in...")
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": email, "password": password})
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful")

    # 3. Search Stock
    print("Searching for AAPL...")
    response = requests.get(f"{BASE_URL}/search?q=AAPL", headers=headers) # Note: Search endpoint is in finnhub_client, might not need auth? 
    # Wait, I put search in finnhub_client router, which is included in main. 
    # But I didn't protect it with Depends(get_current_user). 
    # Let's check if it works.
    if response.status_code == 200:
        print("Search successful")
        # print(response.json())
    else:
        print(f"Search failed: {response.text}")

    # 4. Add to Watchlist
    print("Adding AAPL to watchlist...")
    response = requests.post(f"{BASE_URL}/watchlist/", json={"ticker": "AAPL"}, headers=headers)
    if response.status_code == 200:
        print("Added to watchlist")
    elif response.status_code == 400 and "already in watchlist" in response.text:
        print("Already in watchlist")
    else:
        print(f"Add to watchlist failed: {response.text}")
        sys.exit(1)

    # 5. Get Watchlist
    print("Getting watchlist...")
    response = requests.get(f"{BASE_URL}/watchlist/", headers=headers)
    if response.status_code == 200:
        items = response.json()
        print(f"Watchlist items: {len(items)}")
        found = any(item["ticker"] == "AAPL" for item in items)
        if found:
            print("AAPL found in watchlist")
        else:
            print("AAPL NOT found in watchlist")
            sys.exit(1)
    else:
        print(f"Get watchlist failed: {response.text}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        test_backend()
        print("\nBackend verification PASSED!")
    except requests.exceptions.ConnectionError:
        print("\nConnection refused. Is the server running?")
        sys.exit(1)
