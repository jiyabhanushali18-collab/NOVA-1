from datasets import load_dataset
import re

ds = load_dataset("neuralwork/fashion-style-instruct", split="train")

patterns = {
    "Body shape terms": r"\b(rectangular|rectangle|pear[- ]shaped|hourglass|inverted triangle|apple[- ]shaped|ectomorph|mesomorph|endomorph|body shape|body type)\b",
    "Dress recommendations": r"\b(dress|dresses|a-line|bodycon|maxi dress|midi dress|fit-and-flare)\b",
    "Jeans recommendations": r"\b(jeans|denim|straight[- ]leg|wide[- ]leg|bootcut|flared jeans|skinny jeans)\b",
    "Top recommendations": r"\b(tops|top:|blouse|t-shirt|tee|crop top|peplum)\b",
    "Skin tone / undertone": r"\b(skin tone|skin-tone|undertone|complexion)\b",
    "Colour palettes": r"\b(colour palette|color palette|colour scheme|color scheme|warm tones|cool tones)\b",
}

print(f"\nTOTAL EXAMPLES: {len(ds)}")
print("\n=== KEYWORD COVERAGE ===")

for label, pattern in patterns.items():
    count = sum(
        bool(re.search(pattern, " ".join(
            str(row.get(col, "")) for col in ["input", "completion", "context"]
        ), re.I))
        for row in ds
    )
    print(f"{label}: {count}/{len(ds)}")

print("\n=== BODY-SHAPE EXAMPLES ===")
shown = 0
for row in ds:
    if re.search(patterns["Body shape terms"], str(row["input"]), re.I):
        print("\nINPUT:", row["input"])
        print("OUTPUT:", str(row["completion"])[:700])
        shown += 1
        if shown == 3:
            break
