import urllib.request
import json

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

for model_name in ["nova-fashion:latest", "nova-fashion-1.5b-benchmark:latest"]:
    print(f"\n==================== QUERYING {model_name} DIRECTLY ====================")
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.4,
            "top_p": 0.9
        }
    }
    req = urllib.request.Request(
        "http://localhost:11434/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            res = json.loads(response.read().decode("utf-8"))
            raw = res.get("response", "")
            print(f"--- RAW TEXT FROM {model_name} ---")
            print(raw)
            print("-" * 50)
            with open(f"fashion_ai/trend_intelligence/raw_direct_{model_name.replace(':', '_')}.txt", "w", encoding="utf-8") as out:
                out.write(raw)
    except Exception as e:
        print("Error querying", model_name, e)
