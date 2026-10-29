"""
NOVA Fashion AI — Interactive CLI Prompt Runner
Usage:
  python ask_nova.py "Curate a summer brunch outfit in pastel tones"
  python ask_nova.py --interactive
"""

import sys
import os
import json

# Ensure project root is in python path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fashion_ai.trend_intelligence.trend_grounded_curator import curate_with_trend_grounding

def print_outfit(res: dict):
    if res.get("status") != "success" or not res.get("data"):
        print("\n[!] NOVA could not generate a valid outfit curation.")
        print("Raw output:", res.get("raw_response"))
        return

    data = res["data"]
    meta = res.get("metadata", {})
    
    print("\n" + "=" * 60)
    print("✨ NOVA FASHION CURATION")
    print("=" * 60)
    print(f"🎯 Occasion:  {data.get('occasion', 'N/A')}")
    print(f"🎨 Aesthetic: {data.get('aesthetic', 'N/A')}")
    print(f"🌈 Palette:   {', '.join(data.get('palette', []))}")
    
    if meta.get("matched_trends"):
        print(f"📈 Trends:    {', '.join(meta['matched_trends'])}")

    print("\n--- GARMENTS ---")
    top = data.get("top") or {}
    print(f"• Top:       {top.get('item', 'N/A')} ({top.get('color', '')}, {top.get('fabric', '')})")
    
    bottom = data.get("bottom") or {}
    print(f"• Bottom:    {bottom.get('item', 'N/A')} ({bottom.get('color', '')}, {bottom.get('fabric', '')})")
    
    outer = data.get("outerwear")
    if outer and outer.get("item"):
        print(f"• Outerwear: {outer.get('item', 'N/A')} ({outer.get('color', '')}, {outer.get('fabric', '')})")
        
    footwear = data.get("footwear") or {}
    print(f"• Footwear:  {footwear.get('item', 'N/A')} ({footwear.get('color', '')}, {footwear.get('material', '')})")
    
    accessories = data.get("accessories") or []
    if accessories:
        acc_str = ", ".join([a.get("item", "") for a in accessories if a.get("item")])
        print(f"• Details:   {acc_str}")

    print("\n--- STYLING RATIONALE ---")
    print(data.get("styling_rationale", "N/A"))

    constraints = data.get("constraints_satisfied") or []
    if constraints:
        print(f"\n✅ Constraints Honored: {', '.join(constraints)}")
    print("=" * 60 + "\n")

def main():
    if len(sys.argv) > 1 and sys.argv[1] not in ("--interactive", "-i"):
        prompt = " ".join(sys.argv[1:])
        print(f"\n🔮 Sending prompt to NOVA: '{prompt}'...")
        res = curate_with_trend_grounding(prompt)
        print_outfit(res)
    else:
        print("\n" + "=" * 60)
        print("👗 Welcome to NOVA Fashion AI (Interactive Mode)")
        print("Type your fashion prompt below, or type 'exit' / 'quit' to stop.")
        print("=" * 60)
        while True:
            try:
                prompt = input("\n👗 Your prompt > ").strip()
                if not prompt:
                    continue
                if prompt.lower() in ("exit", "quit", "q"):
                    print("Goodbye!")
                    break
                print("\n🔮 Curating outfit with NOVA AI...")
                res = curate_with_trend_grounding(prompt)
                print_outfit(res)
            except (KeyboardInterrupt, EOFError):
                print("\nSession ended.")
                break

if __name__ == "__main__":
    main()
