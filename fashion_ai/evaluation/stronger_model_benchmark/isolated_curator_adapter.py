#!/usr/bin/env python3
"""
Isolated Curator Adapter for NOVA 1.5B Structured Candidate
Handles Ollama communication, structured JSON validation, deterministic constraint checks,
and single-step controlled retries.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple, List

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from constraint_checker import extract_constraints, check_outfit_constraints

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.environ.get("NOVA_CANDIDATE_MODEL", "nova-fashion-1.5b-benchmark")

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
  "constraints_satisfied": ["list of explicit user constraints satisfied"]
}

CRITICAL RULES:
1. 'top' must ONLY contain upper-body garments (shirt, knit, polo, blouse, tee, tank). NEVER put trousers, pants, shorts, or footwear in 'top'.
2. 'bottom' must ONLY contain lower-body garments (trousers, chinos, jeans, skirt, shorts). NEVER put shirts, blouses, or footwear in 'bottom'.
3. 'outerwear' can be null or a jacket/coat/blazer.
4. 'footwear' must ONLY contain shoes, loafers, boots, derbies, sandals, heels, sneakers.
5. 'accessories' must ONLY contain jewelry, belts, bags, eyewear, watches, scarves.
6. NEGATIVE CONSTRAINTS ARE ABSOLUTE: If the user states 'NO X' (e.g. 'NO black', 'NO sneakers', 'NO hoodies'), that item/color is STRICTLY FORBIDDEN from every garment slot (top, bottom, outerwear, footwear, accessories).
7. GENDER INTEGRITY: Respect the requested gender category. Do not recommend dresses, skirts, or blouses for menswear unless explicitly requested by the wearer.
8. HONEST LIMITS: If asked about future or unverifiable fashion week runway data (e.g. 2026), acknowledge knowledge boundaries honestly in styling_rationale rather than inventing false facts.
"""

def query_ollama(model: str, prompt: str, system: str = None, options: dict = None, timeout: int = 75) -> Dict[str, Any]:
    payload = {
        "model": model,
        "prompt": prompt,
        "format": "json",
        "stream": False
    }
    if system:
        payload["system"] = system
    if options:
        payload["options"] = options

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.time() - t0
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "response": body.get("response", ""),
                "latency_sec": round(elapsed, 3),
                "eval_count": body.get("eval_count", 0),
                "error": None
            }
    except Exception as e:
        elapsed = time.time() - t0
        return {
            "response": "",
            "latency_sec": round(elapsed, 3),
            "eval_count": 0,
            "error": str(e)
        }

def validate_schema(data: Any) -> Tuple[bool, List[str]]:
    """Validates presence and types of core JSON fields."""
    if not isinstance(data, dict):
        return False, ["Root response is not a valid JSON dictionary."]

    errors = []
    required_fields = ["occasion", "aesthetic", "palette", "top", "bottom", "footwear", "styling_rationale"]
    for field in required_fields:
        if field not in data or data[field] is None:
            errors.append(f"Missing required field: '{field}'")
        elif isinstance(data[field], (str, list, dict)) and len(data[field]) == 0:
            errors.append(f"Required field '{field}' is empty.")

    # Validate slot types
    if "top" in data and not isinstance(data["top"], (dict, str)):
        errors.append("Field 'top' must be a dictionary or string.")
    if "bottom" in data and not isinstance(data["bottom"], (dict, str)):
        errors.append("Field 'bottom' must be a dictionary or string.")
    if "footwear" in data and not isinstance(data["footwear"], (dict, str)):
        errors.append("Field 'footwear' must be a dictionary or string.")
    if "palette" in data and not isinstance(data["palette"], (list, str)):
        errors.append("Field 'palette' must be a list of colors or string.")

    return (len(errors) == 0), errors

def curate_structured_outfit(user_prompt: str, options: dict = None) -> Dict[str, Any]:
    """
    Main orchestration entry point:
    1. Extracts explicit constraints
    2. Queries Ollama with schema
    3. Validates schema and constraints
    4. Issues at most 1 controlled retry if needed
    5. Returns clean, sanitized client contract
    """
    start_time = time.time()
    retry_count = 0
    raw_responses = []

    # 1. Extract explicit constraints
    extracted = extract_constraints(user_prompt)

    # 2. Initial query
    opts = options or {"temperature": 0.35, "top_p": 0.85}
    res1 = query_ollama(MODEL_NAME, user_prompt, system=STRUCTURED_SYSTEM_PROMPT, options=opts, timeout=75)
    raw_responses.append(res1["response"])
    initial_latency = res1["latency_sec"]

    if res1["error"]:
        total_time_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "error",
            "error": {
                "code": "MODEL_UNAVAILABLE",
                "message": "Styling service is currently unavailable. Please try again shortly."
            },
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": total_time_ms,
                "retry_count": 0,
                "validation_status": "ERROR",
                "safe_to_display": False
            },
            "_raw_responses": raw_responses,
            "_violations": [f"Ollama error: {res1['error']}"]
        }

    # Parse and validate initial output
    try:
        parsed_outfit = json.loads(res1["response"])
        schema_ok, schema_errors = validate_schema(parsed_outfit)
    except Exception as e:
        parsed_outfit = None
        schema_ok = False
        schema_errors = [f"Malformed JSON: {str(e)}"]

    if schema_ok and parsed_outfit:
        constraints_ok, constraint_violations = check_outfit_constraints(parsed_outfit, extracted, user_prompt)
    else:
        constraints_ok = False
        constraint_violations = schema_errors

    all_violations = schema_errors + constraint_violations
    is_valid = schema_ok and constraints_ok

    # 3. Controlled Retry (max 1) if invalid
    if not is_valid:
        retry_count = 1
        violation_summary = "\n".join([f"- {v}" for v in all_violations])
        retry_prompt = f"""{user_prompt}

[CORRECTION REQUIRED]:
The previous outfit generated was invalid due to the following specific violations:
{violation_summary}

Please regenerate the outfit as a strictly valid JSON object matching the schema, correcting every violation above and honoring all explicit exclusions."""

        res2 = query_ollama(MODEL_NAME, retry_prompt, system=STRUCTURED_SYSTEM_PROMPT, options=opts, timeout=75)
        raw_responses.append(res2["response"])

        if not res2["error"]:
            try:
                retry_outfit = json.loads(res2["response"])
                retry_schema_ok, retry_schema_errs = validate_schema(retry_outfit)
                if retry_schema_ok:
                    retry_c_ok, retry_c_viols = check_outfit_constraints(retry_outfit, extracted, user_prompt)
                    if retry_c_ok:
                        parsed_outfit = retry_outfit
                        is_valid = True
                        all_violations = []
                    else:
                        parsed_outfit = retry_outfit
                        all_violations = retry_c_viols
                else:
                    all_violations = retry_schema_errs
            except Exception as e:
                all_violations = [f"Retry Malformed JSON: {str(e)}"]

    total_time_ms = int((time.time() - start_time) * 1000)

    # 4. Return Client Contract
    if is_valid and parsed_outfit:
        return {
            "status": "success",
            "data": parsed_outfit,
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": total_time_ms,
                "retry_count": retry_count,
                "validation_status": "VALID",
                "safe_to_display": True
            },
            "_raw_responses": raw_responses,
            "_violations": []
        }
    else:
        return {
            "status": "rejected",
            "error": {
                "code": "HARD_CONSTRAINT_VIOLATION",
                "message": "The generated recommendation could not satisfy explicit constraints after revision.",
                "details": all_violations
            },
            "data": parsed_outfit if parsed_outfit else None,
            "metadata": {
                "model": MODEL_NAME,
                "duration_ms": total_time_ms,
                "retry_count": retry_count,
                "validation_status": "FAILED",
                "safe_to_display": False
            },
            "_raw_responses": raw_responses,
            "_violations": all_violations
        }

if __name__ == "__main__":
    prompt = "Curate a clean-girl summer outfit in white and beige with gold jewelry."
    print("Testing isolated curator adapter...")
    res = curate_structured_outfit(prompt)
    print("Status:", res["status"])
    print("Duration:", res["metadata"]["duration_ms"], "ms")
    print("Retries:", res["metadata"]["retry_count"])
    if res["status"] == "success":
        print(json.dumps(res["data"], indent=2))
    else:
        print("Error:", res["error"])
