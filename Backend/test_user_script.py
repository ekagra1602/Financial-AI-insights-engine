import finnhub
finnhub_client = finnhub.Client(api_key="d3e9ushr01qrd38tgs0gd3e9ushr01qrd38tgs10")

try:
    print(finnhub_client.stock_candles('AAPL', 'D', 1590988249, 1591852249))
except Exception as e:
    print(e)
