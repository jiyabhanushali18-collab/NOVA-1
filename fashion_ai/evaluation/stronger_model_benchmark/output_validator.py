#!/usr/bin/env python3
"""
NOVA Structured Output Validation Prototype
Enforces consistent structured schema, programmatic slot validation, and controlled 1-step retry.
"""

import json
import re
import time
import urllib.request
import os

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")

STRUCTURED_SYSTEM_PROMPT = """You are NOVA, an expert digital fashion curator and personal styling oracle.
You must output your outfit recommendation strictly as a valid JSON object matching this schema:
{
  "occasion": "string",
  "aesthetic": "string",
  "palette": ["dominant color", "secondary color", "accent color"],
  "top": {
    "item": "specific upper-body garment",
    "fabric": "material texture",
    "color": "garment color",
    "cut": "silhouette and cut"
  },
  "bottom": {
    "item": "specific lower-body garment (trousers, pants, skirt, shorts)",
    "fabric": "material texture",
    "color": "garment color",
    "fit": "silhouette and rise"
  },
  "outerwear": {
    "item": "jacket, blazer, coat, or null if none",
    "fabric": "material",
    "color": "color"
  },
  "footwear": {
    "item": "shoe model or type",
    "material": "leather, suede, canvas, etc.",
    "color": "color"
  },
  "accessories": [
    {
      "item": "accessory name",
      "material_or_metal": "gold, silver, silk, leather",
      "color": "color"
    }
  ],
  "styling_rationale": "Explanation of silhouette balance, texture dialogue, and proportion rules",
  "constraints_satisfied": ["list of explicit constraints respected"]
}

STRICT SLOT INTEGRITY RULES:
1. 'top' must ONLY contain upper-body garments (shirt, knit, polo, blouse, tee, tank). NEVER put trousers, pants, shorts, or footwear in 'top'.
2. 'bottom' must ONLY contain lower-body garments (trousers, chinos, jeans, skirt, shorts). NEVER put shirts, blouses, or footwear in 'bottom'.
3. 'outerwear' can be null or a jacket/coat/blazer.
4. 'footwear' must ONLY contain shoes, loafers, boots, derbies, sandals, heels, sneakers.
5. 'accessories' must ONLY contain jewelry, belts, bags, eyewear, watches, scarves.
6. NEGATIVE CONSTRAINTS ARE ABSOLUTE: If the user states 'NO X' (e.g. 'NO black', 'NO sneakers', 'NO hoodies'), that item/color is forbidden anywhere in the JSON.
7. GENDER INTEGRITY: Respect the requested gender category. Do not recommend dresses or blouses for menswear unless explicitly requested.
"""

BOTTOM_KEYWORDS = ["trousers", "pants", "jeans", "shorts", "skirt", "chinos", "slacks", "kilt"]
TOP_KEYWORDS = ["shirt", "t-shirt", "tee", "blouse", "sweater", "knit", "polo", "hoodie", "blazer", "jacket", "coat", "vest", "tank", "cardigan"]
FOOTWEAR_KEYWORDS = ["shoes", "loafers", "boots", "sneakers", "sandals", "derbies", "oxfords", "mules", "heels", "flats", "slides", "espadrilles", "brogues"]

def query_ollama_raw(model: str, prompt: str, system: str = None, json_format: bool = True, timeout: int = 75, options: dict = None):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    if system:
        payload["system"] = system
    if json_format:
        payload["format"] = "json"
    if options:
        payload["options"] = options

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={"Content-Type": "application/json"})
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.time() - start_time
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "response": body.get("response", ""),
                "latency_sec": round(elapsed, 3),
                "eval_count": body.get("eval_count", 0),
                "error": None
            }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "response": "",
            "latency_sec": round(elapsed, 3),
            "eval_count": 0,
            "error": str(e)
        }

def validate_outfit_json(data: dict, prompt_meta: dict):
    errors = []
    
    # 1. Required top-level fields
    required_fields = ["occasion", "aesthetic", "palette", "top", "bottom", "footwear", "accessories", "styling_rationale"]
    for f in required_fields:
        if f not in data or data[f] is None or (isinstance(data[f], (str, list, dict)) and len(data[f]) == 0):
            errors.append(f"Missing or empty required field: '{f}'")

    # 2. Extract item names
    top_item = ""
    if isinstance(data.get("top"), dict):
        top_item = str(data["top"].get("item", "")).lower() + " " + str(data["top"].get("fabric", "")).lower()
    elif isinstance(data.get("top"), str):
        top_item = data["top"].lower()

    bottom_item = ""
    if isinstance(data.get("bottom"), dict):
        bottom_item = str(data["bottom"].get("item", "")).lower() + " " + str(data["bottom"].get("fabric", "")).lower()
    elif isinstance(data.get("bottom"), str):
        bottom_item = data["bottom"].lower()

    footwear_item = ""
    if isinstance(data.get("footwear"), dict):
        footwear_item = str(data["footwear"].get("item", "")).lower()
    elif isinstance(data.get("footwear"), str):
        footwear_item = data["footwear"].lower()

    # 3. Garment Slot Semantics
    # Top slot must not have bottoms or shoes
    for b in BOTTOM_KEYWORDS:
        if re.search(rf"\b{b}\b", top_item):
            errors.append(f"Slot error: bottom garment '{b}' misplaced inside 'top' field.")
    for fw in FOOTWEAR_KEYWORDS:
        if re.search(rf"\b{fw}\b", top_item):
            errors.append(f"Slot error: footwear '{fw}' misplaced inside 'top' field.")

    # Bottom slot must not have tops or shoes
    for t in TOP_KEYWORDS:
        if re.search(rf"\b{t}\b", bottom_item):
            errors.append(f"Slot error: upper garment '{t}' misplaced inside 'bottom' field.")
    for fw in FOOTWEAR_KEYWORDS:
        if re.search(rf"\b{fw}\b", bottom_item):
            errors.append(f"Slot error: footwear '{fw}' misplaced inside 'bottom' field.")

    # Footwear slot must actually contain footwear
    if footwear_item and not any(re.search(rf"\b{fw}\b", footwear_item) for fw in FOOTWEAR_KEYWORDS):
        errors.append(f"Slot error: 'footwear' field '{footwear_item}' does not appear to be shoes/footwear.")

    # 4. Negative Constraints
    prompt_text = prompt_meta.get("prompt", "").lower()
    full_json_str = json.dumps(data).lower()
    
    # Check NO black
    if re.search(r"\bno\s+black\b", prompt_text):
        if "black" in full_json_str:
            errors.append("Negative constraint violation: 'black' used despite explicit 'NO black' rule.")

    # Check NO sneakers
    if re.search(r"\bno\s+sneakers?\b", prompt_text):
        if re.search(r"\bsneakers?\b", full_json_str):
            errors.append("Negative constraint violation: 'sneakers' used despite explicit 'NO sneakers' rule.")

    # Check NO hoodies
    if re.search(r"\bno\s+hoodies?\b", prompt_text):
        if re.search(r"\bhoodies?\b", full_json_str):
            errors.append("Negative constraint violation: 'hoodie' used despite explicit 'NO hoodies' rule.")

    # 5. Gender Integrity (conventional checks unless explicitly non-conventional)
    target_gender = prompt_meta.get("target_gender", "").lower()
    is_non_conventional = "non_conventional" in prompt_meta.get("category", "") or "skirt" in prompt_text and "man" in prompt_text
    if target_gender == "men" and not is_non_conventional:
        for fem_item in ["blouse", "dress", "gown"]:
            if re.search(rf"\b{fem_item}\b", full_json_str):
                errors.append(f"Gender integrity violation: '{fem_item}' suggested for men's ensemble.")

    is_valid = (len(errors) == 0)
    return is_valid, errors

def format_json_as_text(data: dict) -> str:
    """Converts structured JSON into standardized text for 10-dimension evaluation."""
    top = data.get("top", {})
    top_str = f"{top.get('item', '')} ({top.get('fabric', '')}, {top.get('color', '')}, {top.get('cut', '')})" if isinstance(top, dict) else str(top)

    bottom = data.get("bottom", {})
    bottom_str = f"{bottom.get('item', '')} ({bottom.get('fabric', '')}, {bottom.get('color', '')}, {bottom.get('fit', '')})" if isinstance(bottom, dict) else str(bottom)

    outerwear = data.get("outerwear")
    outer_str = f"{outerwear.get('item', '')} ({outerwear.get('fabric', '')}, {outerwear.get('color', '')})" if isinstance(outerwear, dict) else (str(outerwear) if outerwear else "None")

    footwear = data.get("footwear", {})
    foot_str = f"{footwear.get('item', '')} ({footwear.get('material', '')}, {footwear.get('color', '')})" if isinstance(footwear, dict) else str(footwear)

    accessories = data.get("accessories", [])
    acc_items = []
    if isinstance(accessories, list):
        for a in accessories:
            if isinstance(a, dict):
                acc_items.append(f"{a.get('item', '')} ({a.get('material_or_metal', '')}, {a.get('color', '')})")
            else:
                acc_items.append(str(a))
    acc_str = ", ".join(acc_items) if acc_items else "None"

    palette = data.get("palette", [])
    palette_str = ", ".join(palette) if isinstance(palette, list) else str(palette)

    text = f"""Occasion: {data.get('occasion', '')}
Aesthetic: {data.get('aesthetic', '')}
Palette: {palette_str}

Top: {top_str}
Outerwear: {outer_str}
Bottom: {bottom_str}
Footwear: {foot_str}
Accessories: {acc_str}

Styling Rationale:
{data.get('styling_rationale', '')}

Constraints Satisfied: {', '.join(data.get('constraints_satisfied', [])) if isinstance(data.get('constraints_satisfied'), list) else str(data.get('constraints_satisfied'))}
"""
    return text.strip()

def run_structured_query(model: str, prompt_meta: dict, options: dict = None, max_retries: int = 1):
    prompt_text = prompt_meta["prompt"]
    
    # 1. Initial attempt
    t0 = time.time()
    res1 = query_ollama_raw(
        model=model,
        prompt=prompt_text,
        system=STRUCTURED_SYSTEM_PROMPT,
        json_format=True,
        timeout=75,
        options=options
    )
    initial_latency = res1["latency_sec"]
    total_latency = initial_latency
    retry_occurred = False
    retry_latency = 0.0
    retry_success = None
    final_errors = []
    parsed_json = None
    
    if res1["error"]:
        return {
            "valid": False,
            "parsed_json": None,
            "formatted_text": "",
            "initial_latency": initial_latency,
            "retry_latency": 0.0,
            "total_latency": total_latency,
            "retry_occurred": False,
            "retry_success": False,
            "errors": [f"Ollama error: {res1['error']}"],
            "raw_response": res1["response"]
        }

    try:
        parsed_json = json.loads(res1["response"])
        is_valid, validation_errors = validate_outfit_json(parsed_json, prompt_meta)
    except Exception as e:
        is_valid = False
        validation_errors = [f"JSON Parse Error: {str(e)}"]

    final_errors = validation_errors

    # 2. Controlled Retry (at most 1)
    if not is_valid and max_retries > 0:
        retry_occurred = True
        err_msg = "; ".join(validation_errors)
        retry_prompt = f"""{prompt_text}

[VALIDATION ERROR IN PREVIOUS OUTPUT]:
The previous JSON output failed validation with the following error(s):
- {err_msg}

Please correct the error(s) and output a corrected, valid JSON object adhering strictly to the schema and slot constraints."""

        res2 = query_ollama_raw(
            model=model,
            prompt=retry_prompt,
            system=STRUCTURED_SYSTEM_PROMPT,
            json_format=True,
            timeout=75,
            options=options
        )
        retry_latency = res2["latency_sec"]
        total_latency = round(initial_latency + retry_latency, 3)

        if not res2["error"]:
            try:
                parsed_retry = json.loads(res2["response"])
                retry_valid, retry_errors = validate_outfit_json(parsed_retry, prompt_meta)
                if retry_valid:
                    parsed_json = parsed_retry
                    is_valid = True
                    retry_success = True
                    final_errors = []
                else:
                    retry_success = False
                    final_errors = retry_errors
                    parsed_json = parsed_retry
            except Exception as e:
                retry_success = False
                final_errors = [f"Retry JSON Parse Error: {str(e)}"]
        else:
            retry_success = False
            final_errors.append(f"Retry Ollama error: {res2['error']}")

    formatted_text = format_json_as_text(parsed_json) if parsed_json else ""

    return {
        "valid": is_valid,
        "parsed_json": parsed_json,
        "formatted_text": formatted_text,
        "initial_latency": initial_latency,
        "retry_latency": retry_latency,
        "total_latency": total_latency,
        "retry_occurred": retry_occurred,
        "retry_success": retry_success,
        "errors": final_errors,
        "raw_response": res1["response"]
    }

if __name__ == "__main__":
    test_meta = {
        "id": "p14",
        "category": "gender_specific_men",
        "prompt": "Recommend a summer outdoor wedding guest outfit for a man. Dress code is semi-formal coastal. Light linen or cotton textures.",
        "target_gender": "men",
        "expected_palette": ["light blue", "sand", "white", "sage", "navy"]
    }
    print("Testing output validator on p14...")
    res = run_structured_query("nova-fashion-1.5b-benchmark", test_meta, options={"temperature": 0.35, "top_p": 0.85})
    print(f"Valid: {res['valid']} | Retry occurred: {res['retry_occurred']} | Latency: {res['total_latency']}s")
    if res['errors']:
        print("Errors:", res['errors'])
    print("\nFormatted Text:")
    print(res["formatted_text"])
