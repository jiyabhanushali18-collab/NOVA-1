#!/usr/bin/env python3
"""
NOVA Deterministic Fashion Constraint Checker
Extracts explicit user requirements and exclusions from prompts and performs
field-specific validation on structured outfit objects without indiscriminate word filtering.
"""

import re
from typing import Dict, Any, List, Tuple

# Common keywords for garment slot semantics
BOTTOM_KEYWORDS = ["trousers", "pants", "jeans", "shorts", "skirt", "chinos", "slacks", "kilt"]
TOP_KEYWORDS = ["shirt", "t-shirt", "tee", "blouse", "sweater", "knit", "polo", "hoodie", "blazer", "jacket", "coat", "vest", "tank", "cardigan"]
FOOTWEAR_KEYWORDS = ["shoes", "loafers", "boots", "sneakers", "sandals", "derbies", "oxfords", "mules", "heels", "flats", "slides", "espadrilles", "brogues"]

def extract_constraints(prompt: str) -> Dict[str, Any]:
    """
    Extracts explicit exclusions, mandatory garments, target gender,
    budget, and climate constraints from user prompt.
    Does NOT infer constraints that the user never specified.
    """
    p_lower = prompt.lower()
    constraints: Dict[str, Any] = {
        "negative_colors": [],
        "negative_garments": [],
        "mandatory_items": [],
        "target_gender": "universal",
        "allows_non_conventional": False,
        "max_budget": None,
        "climate": None,
        "is_trend_query": False,
        "formality": None
    }

    # 1. Negative Exclusions
    # Match patterns like: NO black, NO hoodies, NO sneakers, without denim
    no_matches = re.findall(r"\b(?:no|without|avoid)\s+([a-zA-Z\s\-]+?)(?:,|\.|\band\b|$)", p_lower)
    for m in no_matches:
        tokens = [t.strip() for t in re.split(r"[\s/]+", m) if t.strip()]
        for t in tokens:
            if t in ["black", "white", "navy", "brown", "beige", "red", "green", "pink"]:
                if t not in constraints["negative_colors"]:
                    constraints["negative_colors"].append(t)
            elif t in ["hoodie", "hoodies"]:
                constraints["negative_garments"].append("hoodie")
            elif t in ["sneaker", "sneakers"]:
                constraints["negative_garments"].append("sneaker")
            elif t in ["denim", "jeans"]:
                constraints["negative_garments"].append("denim")
            elif t in ["t-shirt", "tshirt", "t-shirts", "tees", "tee"]:
                constraints["negative_garments"].append("t-shirt")
            elif t in ["cargo", "cargos"]:
                constraints["negative_garments"].append("cargo")

    # 2. Mandatory Items
    if "pleated skirt" in p_lower:
        constraints["mandatory_items"].append("pleated skirt")
    if "cable-knit" in p_lower:
        constraints["mandatory_items"].append("cable-knit")
    if "satin slip skirt" in p_lower or "satin skirt" in p_lower:
        constraints["mandatory_items"].append("satin slip skirt")
    if "wide-leg pleated trousers" in p_lower or "wide-leg trousers" in p_lower:
        constraints["mandatory_items"].append("wide-leg trousers")

    # 3. Target Gender & Non-Conventional Flags
    is_man_skirt = ("man" in p_lower or "men" in p_lower) and ("skirt" in p_lower or "dress" in p_lower)
    if is_man_skirt:
        constraints["target_gender"] = "men"
        constraints["allows_non_conventional"] = True
    elif re.search(r"\b(for a man|for men|men's|male)\b", p_lower):
        constraints["target_gender"] = "men"
    elif re.search(r"\b(for a woman|for women|women's|female)\b", p_lower):
        constraints["target_gender"] = "women"
    elif re.search(r"\b(gender-neutral|androgynous|unisex)\b", p_lower):
        constraints["target_gender"] = "neutral"

    # 4. Budget
    budget_match = re.search(r"\b(?:under|budget of|within)\s+\$?(\d+)\b", p_lower)
    if budget_match:
        constraints["max_budget"] = int(budget_match.group(1))

    # 5. Climate
    if any(k in p_lower for k in ["sweltering", "34°c", "34c", "tropical", "humid", "hot weather", "high humidity"]):
        constraints["climate"] = "hot_humid"
    elif any(k in p_lower for k in ["sub-zero", "freezing", "-10°c", "-10c", "snow", "winter"]):
        constraints["climate"] = "sub_zero"

    # 6. Formality
    if any(k in p_lower for k in ["black-tie", "gala", "formal"]):
        constraints["formality"] = "formal"
    elif any(k in p_lower for k in ["smart casual", "business casual"]):
        constraints["formality"] = "smart_casual"

    # 7. Trend Query
    if any(k in p_lower for k in ["2026", "runway", "latest trend", "has replaced", "fashion week"]):
        constraints["is_trend_query"] = True

    return constraints

def check_outfit_constraints(outfit: Dict[str, Any], constraints: Dict[str, Any], prompt: str) -> Tuple[bool, List[str]]:
    """
    Validates structured outfit fields strictly and deterministically.
    Does NOT search explanation/rationale text indiscriminately.
    """
    violations: List[str] = []

    # 1. Structural Slot Integrity
    top = outfit.get("top") or {}
    bottom = outfit.get("bottom") or {}
    outerwear = outfit.get("outerwear") or {}
    footwear = outfit.get("footwear") or {}
    accessories = outfit.get("accessories") or []

    top_item = str(top.get("item", "")).lower() if isinstance(top, dict) else str(top).lower()
    bottom_item = str(bottom.get("item", "")).lower() if isinstance(bottom, dict) else str(bottom).lower()
    outer_item = str(outerwear.get("item", "")).lower() if isinstance(outerwear, dict) else str(outerwear).lower()
    foot_item = str(footwear.get("item", "")).lower() if isinstance(footwear, dict) else str(footwear).lower()

    # Slot check: Bottoms in top slot
    for b in BOTTOM_KEYWORDS:
        if re.search(rf"\b{b}\b", top_item):
            violations.append(f"Garment slot error: lower-body item '{b}' was placed in 'top' field.")

    # Slot check: Tops in bottom slot
    for t in TOP_KEYWORDS:
        if re.search(rf"\b{t}\b", bottom_item):
            violations.append(f"Garment slot error: upper-body item '{t}' was placed in 'bottom' field.")

    # Slot check: Footwear in footwear slot
    if foot_item and foot_item != "none" and not any(re.search(rf"\b{fw}\b", foot_item) for fw in FOOTWEAR_KEYWORDS):
        violations.append(f"Garment slot error: 'footwear' field '{foot_item}' does not appear to be shoes/footwear.")

    # 2. Negative Color Exclusions
    # Check only actual garment color fields & item names
    for color in constraints.get("negative_colors", []):
        color_pattern = rf"\b{color}\b"
        
        # Check palette list
        palette = outfit.get("palette", [])
        palette_str = " ".join(palette).lower() if isinstance(palette, list) else str(palette).lower()
        if re.search(color_pattern, palette_str):
            violations.append(f"Negative constraint violation: color '{color}' is in palette despite explicit exclusion.")

        # Check top
        if re.search(color_pattern, str(top.get("color", "")).lower()) or re.search(color_pattern, top_item):
            violations.append(f"Negative constraint violation: color '{color}' found in top garment '{top_item}'.")

        # Check bottom
        if re.search(color_pattern, str(bottom.get("color", "")).lower()) or re.search(color_pattern, bottom_item):
            violations.append(f"Negative constraint violation: color '{color}' found in bottom garment '{bottom_item}'.")

        # Check outerwear
        if outerwear and (re.search(color_pattern, str(outerwear.get("color", "")).lower()) or re.search(color_pattern, outer_item)):
            violations.append(f"Negative constraint violation: color '{color}' found in outerwear '{outer_item}'.")

        # Check footwear
        if re.search(color_pattern, str(footwear.get("color", "")).lower()) or re.search(color_pattern, foot_item):
            violations.append(f"Negative constraint violation: color '{color}' found in footwear '{foot_item}'.")

        # Check accessories
        if isinstance(accessories, list):
            for acc in accessories:
                acc_name = acc.get("item", "").lower() if isinstance(acc, dict) else str(acc).lower()
                acc_color = acc.get("color", "").lower() if isinstance(acc, dict) else ""
                if re.search(color_pattern, acc_color) or re.search(color_pattern, acc_name):
                    violations.append(f"Negative constraint violation: color '{color}' found in accessory '{acc_name}'.")

    # 3. Negative Garment Exclusions
    for garment in constraints.get("negative_garments", []):
        g_pattern = rf"\b{garment}s?\b"
        if re.search(g_pattern, top_item):
            violations.append(f"Negative constraint violation: '{garment}' in top slot despite explicit exclusion.")
        if re.search(g_pattern, bottom_item):
            violations.append(f"Negative constraint violation: '{garment}' in bottom slot despite explicit exclusion.")
        if outerwear and re.search(g_pattern, outer_item):
            violations.append(f"Negative constraint violation: '{garment}' in outerwear slot despite explicit exclusion.")
        if re.search(g_pattern, foot_item):
            violations.append(f"Negative constraint violation: '{garment}' in footwear slot despite explicit exclusion.")

    # 4. Mandatory Garments
    for req in constraints.get("mandatory_items", []):
        req_pattern = rf"\b{req}\b"
        all_garments_str = f"{top_item} {bottom_item} {outer_item}".lower()
        if not re.search(req_pattern, all_garments_str):
            violations.append(f"Mandatory requirement violation: required item '{req}' was missing from the ensemble.")

    # 5. Gender & Category Integrity
    target_gender = constraints.get("target_gender")
    allows_non_conv = constraints.get("allows_non_conventional", False)
    if target_gender == "men" and not allows_non_conv:
        for fem_item in ["blouse", "dress", "gown", "skirt"]:
            fem_pattern = rf"\b{fem_item}s?\b"
            if re.search(fem_pattern, top_item) or re.search(fem_pattern, bottom_item) or re.search(fem_pattern, outer_item):
                violations.append(f"Gender integrity violation: female item '{fem_item}' suggested for men's ensemble.")

    # 6. Climate Realism
    climate = constraints.get("climate")
    if climate == "hot_humid":
        # Forbid heavy overcoats/down in 34C tropical weather
        for heavy in ["wool overcoat", "heavy coat", "down coat", "puffer jacket", "trench coat", "chunky cable-knit"]:
            if re.search(rf"\b{heavy}\b", outer_item) or re.search(rf"\b{heavy}\b", top_item):
                violations.append(f"Climate realism violation: '{heavy}' is inappropriate for sweltering 34°C humid tropical climate.")
    elif climate == "sub_zero":
        for light in ["shorts", "open-toe", "sandals", "slides"]:
            if re.search(rf"\b{light}\b", bottom_item) or re.search(rf"\b{light}\b", foot_item):
                violations.append(f"Climate realism violation: '{light}' is dangerous for sub-zero winter weather.")

    is_compliant = (len(violations) == 0)
    return is_compliant, violations

if __name__ == "__main__":
    test_prompt = "Curate an elevated casual Friday outfit. STRICT EXCLUSION: NO black clothing, NO hoodies, and NO sneakers anywhere in the outfit."
    c = extract_constraints(test_prompt)
    print("Extracted constraints:", c)

    bad_outfit = {
        "palette": ["cream", "olive", "brown"],
        "top": {"item": "Cashmere Hoodie", "fabric": "Cashmere", "color": "Cream"},
        "bottom": {"item": "Pleated Trousers", "fabric": "Wool", "color": "Olive"},
        "outerwear": None,
        "footwear": {"item": "Leather Loafers", "color": "Brown"},
        "accessories": [{"item": "Belt", "color": "Black"}],
        "styling_rationale": "We avoided sneakers to keep it elevated."
    }
    ok, viols = check_outfit_constraints(bad_outfit, c, test_prompt)
    print("Compliant:", ok)
    print("Violations detected:", viols)
