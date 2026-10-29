import urllib.request
import json
import time

system_prompt = """You are NOVA, an expert digital fashion curator.
You MUST output your recommendation strictly as a JSON object adhering to this structure:
{
  "occasion": "string",
  "aesthetic": "string",
  "palette": ["string"],
  "top": {"item": "string", "fabric": "string", "color": "string", "cut": "string"},
  "bottom": {"item": "string", "fabric": "string", "color": "string", "fit": "string"},
  "outerwear": {"item": "string", "fabric": "string", "color": "string"} or null,
  "footwear": {"item": "string", "material": "string", "color": "string"},
  "accessories": [{"item": "string", "material_or_metal": "string", "color": "string"}],
  "styling_rationale": "string",
  "constraints_satisfied": ["string"]
}

STRICT SLOT INTEGRITY RULES:
1. 'top': upper body garments only (e.g. shirt, polo, sweater, tee, blouse). NEVER place trousers, shorts, or shoes here.
2. 'bottom': lower body garments only (e.g. trousers, chinos, pants, shorts, skirt). NEVER place shirts, blouses, or shoes here.
3. 'outerwear': jackets, blazers, overcoats only, or null if unneeded.
4. 'footwear': shoes, loafers, derbies, boots, sandals only.
5. 'accessories': jewelry, watches, belts, pocket squares, bags only.
"""

# Let's test on prompt p14 (which previously put trousers under Top and suggested a blouse for a man)
prompt = "Recommend a summer outdoor wedding guest outfit for a man. Dress code is semi-formal coastal. Light linen or cotton textures."

payload = {
    "model": "nova-fashion-1.5b-benchmark",
    "prompt": prompt,
    "system": system_prompt,
    "format": "json",
    "stream": False,
    "options": {"temperature": 0.35, "top_p": 0.85}
}

req = urllib.request.Request(
    "http://localhost:11434/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

start = time.time()
with urllib.request.urlopen(req, timeout=90) as resp:
    res = json.loads(resp.read().decode("utf-8"))
elapsed = time.time() - start

print(f"JSON generation latency: {elapsed:.2f}s | Eval count: {res.get('eval_count')} tokens")
try:
    parsed = json.loads(res.get("response", ""))
    print(json.dumps(parsed, indent=2))
except Exception as e:
    print("Failed to parse JSON:", e)
    print(res.get("response", ""))
