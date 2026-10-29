"""
Audit the neuralwork/fashion-style-instruct dataset across the 12 Phase 1 dimensions.
Uses local cache to avoid external network requests.
"""

import re
import json
from datasets import load_dataset

try:
    ds = load_dataset("neuralwork/fashion-style-instruct", split="train")
except Exception as e:
    print(f"Error loading dataset: {e}")
    exit(1)

total = len(ds)
print(f"Total examples in training dataset: {total}\n")

# Dimensions to audit
dimensions = {
    "1. Men's clothing & styling": r"\b(men|man|male|gentleman|guy|menswear|suit|tuxedo|chinos|tie)\b",
    "2. Women's clothing & styling": r"\b(women|woman|female|lady|dress|skirt|blouse|heels|gown)\b",
    "3. Gender-neutral / non-conventional": r"\b(gender[- ]neutral|unisex|androgynous|non-binary|genderless)\b",
    "4. Clean-girl / Pinterest aesthetic": r"\b(clean[- ]girl|pinterest|slick|dewy|capsule aesthetic)\b",
    "5. Minimalist / elevated casual": r"\b(minimalist|minimalism|elevated casual|old money|quiet luxury|smart casual)\b",
    "6. Gen Z Streetwear": r"\b(streetwear|gorpcore|y2k|cargo|oversized|baggy|chunky sneakers|hoodie)\b",
    "7. Silhouette, proportion, fabric": r"\b(silhouette|proportion|drape|fabric|texture|linen|wool|silk|cashmere|cotton|denim)\b",
    "8. Colour theory & palettes": r"\b(color theory|colour theory|palette|undertone|contrast|monochrome|analogous|complementary)\b",
    "9. Shoes & Accessories": r"\b(shoes|sneakers|boots|loafers|bag|jewelry|accessories|belt|watch)\b",
    "10. Occasion, climate, budget": r"\b(occasion|wedding|interview|winter|summer|rain|monsoon|budget|affordable|thrift|expensive|luxury)\b",
    "11. Capsule wardrobe & versatility": r"\b(capsule|versatility|versatile|mix and match|repeat|repetition)\b",
    "12. Current & seasonal trends": r"\b(trend|trending|2023|2024|2025|2026|tiktok|runway|viral)\b"
}

results = {}
for name, pattern in dimensions.items():
    matched = 0
    sample_matches = []
    for row in ds:
        text = " ".join(str(row.get(col, "")) for col in ["input", "completion", "context"])
        if re.search(pattern, text, re.I):
            matched += 1
            if len(sample_matches) < 2:
                sample_matches.append({
                    "input": str(row.get("input", ""))[:150],
                    "completion": str(row.get("completion", ""))[:200]
                })
    pct = round((matched / total) * 100, 1)
    results[name] = {
        "count": matched,
        "percentage": pct,
        "samples": sample_matches
    }
    print(f"{name:<40}: {matched:>5} / {total} ({pct:>5}%)")

with open("fashion_ai/evaluation/dataset_audit.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("\nAudit saved to fashion_ai/evaluation/dataset_audit.json")
