"""Test the updated AI100 client with the new structured text approach."""
import os
from dotenv import load_dotenv
load_dotenv()

from services.ai100_client import analyze_text
import json

sample_text = """
Apple Inc. reported record quarterly revenue of $123.9 billion for the fiscal 2025 first quarter, 
up 4% from the year-ago period. CEO Tim Cook highlighted strong demand for the iPhone 16 lineup 
and the growing services business, which reached an all-time high of $23.1 billion. 
The company also announced a $110 billion share buyback program, the largest in its history.
Analysts remain bullish on the stock, citing the company's strong ecosystem and AI initiatives.
"""

print("=" * 60)
print("TEST: analyze_text() with sample article")
print("=" * 60)

result = analyze_text(sample_text)

print("\n" + "=" * 60)
print("FINAL RESULT:")
print("=" * 60)
print(json.dumps(result, indent=2))

# Validate
assert isinstance(result, dict), "Should be dict"
assert "summary" in result, "Missing summary"
assert "sentiment" in result, "Missing sentiment"
assert "tone" in result, "Missing tone"
assert "keywords" in result, "Missing keywords"
assert result["sentiment"] in ("positive", "negative", "neutral"), f"Bad sentiment: {result['sentiment']}"
assert result["tone"] in ("bullish", "bearish", "neutral"), f"Bad tone: {result['tone']}"
assert isinstance(result["keywords"], list), "Keywords should be list"

# Check it's NOT a mock (should have real content now)
if result["keywords"] == []:
    if "..." in result["summary"]:
        print("\n⚠️  Looks like a mock/fallback response")
    else:
        print("\n✅ Got real response (empty keywords is OK)")
else:
    print(f"\n✅ Got real AI response with {len(result['keywords'])} keywords!")
    
print("✅ All assertions passed!")
