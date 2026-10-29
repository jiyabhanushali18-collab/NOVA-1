import sys
import os
import json

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fashion_ai.trend_intelligence.trend_grounded_curator import curate_with_trend_grounding

prompt = """Create a complete outfit recommendation for me.

- Clothing category: Women's clothing
- Age range: 18–24
- Aesthetic: Clean girl / clean aesthetic
- Occasion: College / everyday
- Budget: Under ₹1,000 for the complete outfit
- Climate: Hot and humid
- Exclusions: None specified

Requirements:
1. Interpret the aesthetic thoughtfully instead of defaulting to white, beige and cream basics.
2. Consider contemporary Gen Z silhouettes and styling proportions, including relaxed, baggy, extra-long or mid-length bottoms where appropriate. Do not default to narrow-fit trousers.
3. Use current trend knowledge where relevant, but distinguish verified trends from general styling principles.
4. Recommend a coordinated top, bottom, footwear and accessories.
5. Give realistic Indian-market price estimates and ensure the total stays under ₹1,000. Clearly identify items that need to be reused to meet the budget.
6. Explain the colour coordination, silhouette, fabric, climate suitability and why the outfit fits the requested aesthetic.
7. Do not assume that every Gen Z person follows the same trends. Make deliberate styling choices and explain them."""

print("Calling NOVA AI with trend grounding...")
res = curate_with_trend_grounding(prompt)

with open("fashion_ai/trend_intelligence/user_prompt_raw_response.json", "w", encoding="utf-8") as f:
    json.dump(res, f, indent=2, ensure_ascii=False)

print("Status:", res.get("status"))
print("Duration:", res.get("duration_sec"))
print("--- RAW RESPONSE START ---")
print(res.get("raw_response"))
print("--- RAW RESPONSE END ---")
