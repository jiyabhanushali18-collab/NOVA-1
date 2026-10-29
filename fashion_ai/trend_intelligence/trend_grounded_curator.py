#!/usr/bin/env python3
"""
NOVA Grounded Trend Retrieval & Curator Prototype
Retrieves dated, sourced trend attributes from trend_library.json and provides
isolated contextual grounding to the structured 1.5B model without reference bleeding.
"""

import json
import os
import sys
import re
import time
from typing import Dict, Any, List, Optional, Tuple

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCHMARK_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "evaluation", "stronger_model_benchmark"))
if BENCHMARK_DIR not in sys.path:
    sys.path.insert(0, BENCHMARK_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from constraint_checker import extract_constraints, check_outfit_constraints
from isolated_curator_adapter import query_ollama, validate_schema, STRUCTURED_SYSTEM_PROMPT, MODEL_NAME

TREND_LIB_PATH = os.path.join(CURRENT_DIR, "trend_library.json")
PRINCIPLES_PATH = os.path.abspath(os.path.join(CURRENT_DIR, "..", "knowledge", "enduring_principles.json"))

def load_trend_library() -> List[Dict[str, Any]]:
    if not os.path.exists(TREND_LIB_PATH):
        return []
    with open(TREND_LIB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("trends", [])

def load_enduring_principles() -> List[Dict[str, Any]]:
    if not os.path.exists(PRINCIPLES_PATH):
        return []
    with open(PRINCIPLES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("principles", [])

ALL_TRENDS = load_trend_library()
ALL_PRINCIPLES = load_enduring_principles()

def retrieve_relevant_trends(prompt: str, max_trends: int = 2) -> Tuple[List[Dict[str, Any]], str]:
    """
    Scans trend_library.json for trends matching user prompt keywords, aesthetics, or regions.
    Returns matched trends and grounding text formatted as isolated attributes.
    """
    p_lower = prompt.lower()
    scored_trends = []

    for t in ALL_TRENDS:
        score = 0
        name_lower = t["trend_name"].lower()
        desc_lower = t["description"].lower()
        aesthetics = [a.lower() for a in t.get("relevant_aesthetics", [])]
        region = t.get("region", "").lower()

        # Direct name or keyword match
        if any(w in p_lower for w in ["barrel", "horseshoe"]) and "barrel" in name_lower:
            score += 10
        if any(w in p_lower for w in ["butter yellow", "yellow neutral"]) and "butter yellow" in name_lower:
            score += 10
        if any(w in p_lower for w in ["mesh", "fishnet", "sheer flats"]) and "mesh" in name_lower:
            score += 10
        if any(w in p_lower for w in ["retro runner", "samba", "speedcat", "ballet sneaker", "replacement for chunky", "replace chunky", "loafer"]) and "runner" in name_lower:
            score += 10
        if any(w in p_lower for w in ["drop waist", "drop-waist", "dropped waist"]) and "drop-waist" in name_lower:
            score += 10
        if any(w in p_lower for w in ["blokecore", "jersey", "football jersey", "rugby"]) and "blokecore" in name_lower:
            score += 10
        if any(w in p_lower for w in ["coquette", "balletcore", "ribbon", "lace"]) and "coquette" in name_lower:
            score += 10
        if any(w in p_lower for w in ["kurti", "chikankari", "desi", "indo-western", "indian"]) and "kurti" in name_lower:
            score += 10
        if any(w in p_lower for w in ["oxidised", "silver jewelry", "jhumka", "tribal silver"]) and "oxidised" in name_lower:
            score += 10
        if any(w in p_lower for w in ["burgundy", "cherry", "oxblood", "wine"]) and "burgundy" in name_lower:
            score += 10
        if any(w in p_lower for w in ["capri", "pedal pusher"]) and "capri" in name_lower:
            score += 10
        if any(w in p_lower for w in ["ajrakh", "block-print", "handloom", "sanganeri"]) and "ajrakh" in name_lower:
            score += 10

        # Aesthetic matches
        for a in aesthetics:
            clean_a = a.replace("_", " ")
            if clean_a in p_lower:
                score += 5

        # Indian region signals
        if any(loc in p_lower for loc in ["india", "indian", "delhi", "mumbai", "bangalore", "kolkata", "chennai"]):
            if "india" in region:
                score += 4

        # General trend query signals
        if any(k in p_lower for k in ["trend", "trending", "runway", "fashion week", "latest", "now"]):
            score += 1

        if score > 0:
            scored_trends.append((score, t))

    scored_trends.sort(key=lambda x: x[0], reverse=True)
    selected_trends = [t for _, t in scored_trends[:max_trends]]

    # Format grounding text as attributes (NO full outfits, preventing reference bleed!)
    grounding_parts = []
    if selected_trends:
        grounding_parts.append("[VERIFIED CURRENT FASHION TREND EVIDENCE]:")
        for t in selected_trends:
            grounding_parts.append(
                f"- Trend: {t['trend_name']}\n"
                f"  Evidence: {t['description']}\n"
                f"  Sartorial Element: {t['suggested_garment_combinations'].get('top', '')} / {t['suggested_garment_combinations'].get('bottom', '')}\n"
                f"  Footwear Direction: {t['suggested_garment_combinations'].get('footwear', '')}\n"
                f"  Source Verification: {t['source_title']} ({t['source_url']}), Pub: {t['publication_date']}\n"
                f"  Status: {t.get('status', 'active')} (Confidence: {t.get('confidence', 'high')})"
            )
        grounding_parts.append(
            "CRITICAL GOVERNANCE: The trend intelligence above is supplementary context. "
            "User explicit requirements, requested garments, and negative exclusions (e.g. 'NO black') "
            "STRICTLY OVERRIDE all trend suggestions. Do NOT copy unrelated colors into user output."
        )
    else:
        # Fall back to enduring styling principles
        grounding_parts.append("[ENDURING STYLING PRINCIPLES (No specific micro-trend detected)]:")
        grounding_parts.append(
            "- Rule of Thirds: Maintain 1/3 upper to 2/3 lower body visual proportion.\n"
            "- Texture Tension: Balance contrasting tactile surfaces (e.g. coarse weave with smooth fluid drapery).\n"
            "- Volume Balancing: Pair relaxed or wide silhouettes with tailored, fitted structures."
        )

    grounding_text = "\n".join(grounding_parts)
    return selected_trends, grounding_text

def curate_with_trend_grounding(prompt: str, options: dict = None) -> Dict[str, Any]:
    """
    Curates a structured outfit by injecting relevant, dated trend intelligence
    and enforcing programmatic validation with max 1 retry.
    """
    start_time = time.time()
    extracted_constraints = extract_constraints(prompt)

    # 1. Retrieve trend grounding
    matched_trends, grounding_context = retrieve_relevant_trends(prompt)

    # Check if factual trend inquiry vs outfit request
    is_factual_trend_inquiry = extracted_constraints.get("is_trend_query", False) and any(
        q in prompt.lower() for q in ["what trend", "what specific", "has replaced", "cite verified", "which trend", "tell me about"]
    )

    # 2. Build augmented prompt
    augmented_prompt = f"""{prompt}

{grounding_context}
"""
    if is_factual_trend_inquiry:
        augmented_prompt += "\nNOTE: This is a trend inquiry. In the 'styling_rationale' field, thoroughly answer the user's factual trend question citing the verified source evidence provided above. In garment slots, provide a representative ensemble illustrating the trend."

    opts = options or {"temperature": 0.35, "top_p": 0.85}
    
    # 3. Initial Ollama call
    res1 = query_ollama(
        model=MODEL_NAME,
        prompt=augmented_prompt,
        system=STRUCTURED_SYSTEM_PROMPT,
        options=opts,
        timeout=75
    )
    initial_latency = res1["latency_sec"]
    retry_count = 0
    parsed_outfit = None
    all_violations = []

    if res1["error"]:
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "error",
            "error": {"code": "MODEL_ERROR", "message": res1["error"]},
            "data": None,
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": duration_ms,
                "retry_count": 0,
                "trend_grounded": len(matched_trends) > 0,
                "matched_trends": [t["trend_name"] for t in matched_trends],
                "safe_to_display": False
            }
        }

    # Parse and validate
    try:
        parsed_outfit = json.loads(res1["response"])
        schema_ok, schema_errors = validate_schema(parsed_outfit)
    except Exception as e:
        schema_ok = False
        schema_errors = [f"Malformed JSON: {str(e)}"]

    if schema_ok and parsed_outfit:
        constraints_ok, constraint_violations = check_outfit_constraints(parsed_outfit, extracted_constraints, prompt)
    else:
        constraints_ok = False
        constraint_violations = schema_errors

    all_violations = schema_errors + constraint_violations
    is_valid = schema_ok and constraints_ok

    # 4. Controlled 1-step retry if invalid
    if not is_valid:
        retry_count = 1
        violation_summary = "\n".join([f"- {v}" for v in all_violations])
        retry_prompt = f"""{augmented_prompt}

[CORRECTION REQUIRED]:
The previous outfit generated was invalid due to the following specific violations:
{violation_summary}

Please regenerate the outfit as a strictly valid JSON object matching the schema, correcting every violation above and honoring all explicit exclusions."""

        res2 = query_ollama(MODEL_NAME, retry_prompt, system=STRUCTURED_SYSTEM_PROMPT, options=opts, timeout=75)
        if not res2["error"]:
            try:
                retry_outfit = json.loads(res2["response"])
                r_schema_ok, r_schema_errs = validate_schema(retry_outfit)
                if r_schema_ok:
                    r_c_ok, r_c_viols = check_outfit_constraints(retry_outfit, extracted_constraints, prompt)
                    if r_c_ok:
                        parsed_outfit = retry_outfit
                        is_valid = True
                        all_violations = []
                    else:
                        parsed_outfit = retry_outfit
                        all_violations = r_c_viols
                else:
                    all_violations = r_schema_errs
            except Exception as e:
                all_violations = [f"Retry Malformed JSON: {str(e)}"]

    duration_ms = int((time.time() - start_time) * 1000)

    # 5. Attach source provenance
    sources_cited = [
        {
            "trend_name": t["trend_name"],
            "source_title": t["source_title"],
            "source_url": t["source_url"],
            "publication_date": t["publication_date"],
            "confidence": t["confidence"]
        }
        for t in matched_trends
    ]

    if is_valid and parsed_outfit:
        return {
            "status": "success",
            "data": parsed_outfit,
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": duration_ms,
                "retry_count": retry_count,
                "trend_grounded": len(matched_trends) > 0,
                "matched_trends": [t["trend_name"] for t in matched_trends],
                "sources_cited": sources_cited,
                "validation_status": "VALID",
                "safe_to_display": True
            },
            "_raw_response": res1["response"]
        }
    else:
        return {
            "status": "rejected",
            "error": {
                "code": "HARD_CONSTRAINT_VIOLATION",
                "message": "Outfit violated explicit constraints after retry.",
                "details": all_violations
            },
            "data": parsed_outfit,
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": duration_ms,
                "retry_count": retry_count,
                "trend_grounded": len(matched_trends) > 0,
                "matched_trends": [t["trend_name"] for t in matched_trends],
                "sources_cited": sources_cited,
                "validation_status": "FAILED",
                "safe_to_display": False
            },
            "_raw_response": res1["response"]
        }

if __name__ == "__main__":
    test_q = "What is the latest 2025/2026 trend in casual footwear replacing chunky dad shoes? Cite verified sources."
    print("Testing trend grounded curator on factual trend query...")
    res = curate_with_trend_grounding(test_q)
    print("Status:", res["status"])
    print("Matched Trends:", res["metadata"]["matched_trends"])
    print("Sources Cited:", res["metadata"]["sources_cited"])
    if res["data"]:
        print("Footwear:", res["data"].get("footwear"))
        print("Rationale:", res["data"].get("styling_rationale"))
