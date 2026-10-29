#!/usr/bin/env python3
"""
Repeatable Evaluation Engine for NOVA Fashion AI.
Evaluates local Ollama models on a multi-dimensional fashion rubric:
1. Outfit Coherence & Wearability
2. Color Palette Consistency
3. Footwear & Accessories Coordination
4. Specificity of Fit & Silhouette
5. Aesthetic Relevance
6. Personalization & Constraint Compliance
7. Diversity & Concept Structure
8. Practicality for Occasion & Budget
9. Trend Reliability & Transparency
10. Gender & Clothing-Category Compliance
"""

import sys
import os
import json
import time
import re
import argparse
import urllib.request
import urllib.error

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")

COLOR_MAP = {
    "cream": ["cream", "off-white", "ecru", "ivory", "vanilla"],
    "sage green": ["sage", "sage green", "pale olive", "eucalyptus", "muted green"],
    "white": ["white", "crisp white", "snow"],
    "neutral": ["beige", "tan", "camel", "taupe", "oatmeal", "khaki", "nude", "neutral"],
    "charcoal": ["charcoal", "dark grey", "anthracite", "graphite"],
    "black": ["black", "jet black", "noir"],
    "grey": ["grey", "gray", "slate", "heather grey"],
    "ivory": ["ivory", "bone", "cream"],
    "navy": ["navy", "navy blue", "midnight blue", "dark navy"],
    "earth tones": ["brown", "olive", "terracotta", "tan", "rust", "khaki", "moss"],
    "silver": ["silver", "metallic", "chrome", "pewter"],
    "burgundy": ["burgundy", "wine", "maroon", "bordeaux", "deep red"],
    "denim blue": ["denim", "indigo", "light wash", "medium wash", "blue jeans"]
}

NONSENSE_PHRASES = [
    r"skin\s+height",
    r"hair\s+height",
    r"proportions\s+based\s+on\s+your\s+skin",
    r"visual\s+interest\s+around\s+your\s+wrists\s+and\s+ankles",
    r"skin\s+and\s+hair\s+length",
    r"skin\s+and\s+hair\s+attributes\s+are\s+provided",
    r"stylecuration",
    r"internal\s+system\s+instructions"
]

def query_ollama(model: str, prompt: str, system: str = None, options: dict = None, timeout: int = 75):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    if system:
        payload["system"] = system
    if options:
        payload["options"] = options

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.time() - start_time
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "response": body.get("response", ""),
                "latency_sec": round(elapsed, 3),
                "eval_count": body.get("eval_count", 0),
                "eval_duration_ms": round(body.get("eval_duration", 0) / 1e6, 1),
                "error": None
            }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "response": "",
            "latency_sec": round(elapsed, 3),
            "eval_count": 0,
            "eval_duration_ms": 0,
            "error": str(e)
        }

def score_response(prompt_meta: dict, response_text: str):
    scores = {}
    diagnostics = []

    text_lower = response_text.lower()
    word_count = len(response_text.split())

    if not response_text.strip() or word_count < 15:
        return {k: 1.0 for k in [
            "coherence", "palette_consistency", "accessories_coordination",
            "fit_and_silhouette", "aesthetic_relevance", "constraint_compliance",
            "diversity_and_structure", "practicality", "trend_reliability", "gender_compliance"
        ]}, ["Empty or extremely short response (<15 words)."]

    # 1. Coherence & Wearability
    coherence = 4.0
    for np in NONSENSE_PHRASES:
        if re.search(np, text_lower):
            coherence -= 1.5
            diagnostics.append(f"Detected hallucinated/awkward phrase: '{np}'")
    
    # Check for outfit layering conflict (e.g. blouse AND turtleneck in same single outfit)
    has_multiple_tops = bool(re.search(r"\b(blouse|t-shirt|tee|shirt|button-down)\b", text_lower) and 
                            re.search(r"\b(turtleneck|sweater|hoodie|sweatshirt)\b", text_lower))
    has_structure_labels = bool(re.search(r"\b(option\s+[12a-b]|look\s+[12a-b]|layer\s+the|outerwear|over\s+the)\b", text_lower))
    if has_multiple_tops and not has_structure_labels and not ("jacket" in text_lower or "cardigan" in text_lower or "coat" in text_lower):
        coherence -= 1.0
        diagnostics.append("Multiple primary tops listed without clear layering or option demarcation")
    
    # Check if essential clothing components exist (top, bottom/dress, shoes)
    has_top = bool(re.search(r"\b(shirt|blouse|tee|top|knit|sweater|polo|hoodie|cardigan|jacket|blazer|corset|tank)\b", text_lower))
    has_bottom = bool(re.search(r"\b(trousers|pants|jeans|skirt|shorts|chinos|cargos|slacks|dress)\b", text_lower))
    has_shoes = bool(re.search(r"\b(sneakers|boots|loafers|sandals|shoes|mules|derbies|oxfords|flats|heels|slides)\b", text_lower))

    if not (has_top and (has_bottom or "dress" in text_lower) and has_shoes):
        coherence -= 0.5
        missing = []
        if not has_top: missing.append("top")
        if not has_bottom: missing.append("bottom")
        if not has_shoes: missing.append("footwear")
        diagnostics.append(f"Incomplete outfit ensemble (missing: {', '.join(missing)})")
    
    scores["coherence"] = max(1.0, min(5.0, round(coherence, 1)))

    # 2. Palette Consistency
    palette_score = 4.0
    expected_colors = prompt_meta.get("expected_palette", [])
    if expected_colors:
        matched_colors = 0
        for exp in expected_colors:
            variants = COLOR_MAP.get(exp.lower(), [exp.lower()])
            if any(re.search(rf"\b{re.escape(v)}\b", text_lower) for v in variants):
                matched_colors += 1
        
        ratio = matched_colors / len(expected_colors)
        if ratio >= 0.7:
            palette_score = 5.0
        elif ratio >= 0.4:
            palette_score = 4.0
        elif ratio > 0.1:
            palette_score = 3.0
            diagnostics.append(f"Only partially matched requested palette ({matched_colors}/{len(expected_colors)})")
        else:
            palette_score = 2.0
            diagnostics.append(f"Failed to feature requested palette colors: {expected_colors}")

    scores["palette_consistency"] = max(1.0, min(5.0, round(palette_score, 1)))

    # 3. Footwear and Accessories Coordination
    acc_score = 3.5
    if has_shoes:
        acc_score += 0.5
    
    # Check for accessories
    has_accessories = bool(re.search(r"\b(bag|tote|backpack|handbag|belt|watch|jewelry|earrings|necklace|cap|beanie|scarf|glasses|sunglasses)\b", text_lower))
    if has_accessories:
        acc_score += 0.5

    # Check for discordant metal mixing (e.g. silver belt and gold bracelet in same basic outfit)
    if "silver" in text_lower and "gold" in text_lower and "mix" not in text_lower:
        acc_score -= 0.5
        diagnostics.append("Random mixed metals (gold and silver) without intentional mixed-metal styling note")

    # Clashing accessories with occasion
    if "skate" in prompt_meta.get("prompt", "").lower() and ("heels" in text_lower or "dress shoes" in text_lower):
        acc_score -= 1.5
        diagnostics.append("Inappropriate footwear for skate activity")
    
    scores["accessories_coordination"] = max(1.0, min(5.0, round(acc_score, 1)))

    # 4. Specificity of Fit, Silhouette & Styling Details
    fit_keywords = [
        "oversized", "tailored", "relaxed", "wide-leg", "straight-leg", "cropped", "boxy",
        "high-waisted", "high-rise", "tapered", "french tuck", "half-tuck", "cuffed", "slim",
        "drop-shoulder", "pleated", "silhouette", "proportions", "draped", "chunky"
    ]
    matched_fits = [k for k in fit_keywords if re.search(rf"\b{k}\b", text_lower)]
    if len(matched_fits) >= 4:
        fit_score = 5.0
    elif len(matched_fits) >= 2:
        fit_score = 4.0
    elif len(matched_fits) >= 1:
        fit_score = 3.0
    else:
        fit_score = 2.0
        diagnostics.append("Lacks concrete silhouette or fit details (e.g. wide-leg, oversized, tailored)")
    
    scores["fit_and_silhouette"] = fit_score

    # 5. Aesthetic Relevance
    aesthetic = prompt_meta.get("aesthetic", "").lower()
    aes_score = 4.0
    if aesthetic == "clean_girl":
        cues = ["sleek", "neutral", "gold", "fresh", "linen", "slick", "minimal", "dewy", "clean", "white", "tailored"]
        match_count = sum(1 for c in cues if c in text_lower)
        aes_score = 5.0 if match_count >= 3 else (4.0 if match_count >= 1 else 2.5)
    elif aesthetic == "minimalist":
        cues = ["clean lines", "capsule", "understated", "monochrome", "simple", "timeless", "functional", "streamlined", "neutral"]
        match_count = sum(1 for c in cues if c in text_lower)
        aes_score = 5.0 if match_count >= 3 else (4.0 if match_count >= 1 else 2.5)
    elif aesthetic == "streetwear":
        cues = ["boxy", "sneakers", "hoodie", "cargo", "oversized", "baggy", "graphic", "chunky", "skate", "street"]
        match_count = sum(1 for c in cues if c in text_lower)
        aes_score = 5.0 if match_count >= 3 else (4.0 if match_count >= 1 else 2.5)
    elif aesthetic == "elevated_casual":
        cues = ["tailored", "smart", "loafers", "knit", "polo", "trousers", "polished", "sophisticated"]
        match_count = sum(1 for c in cues if c in text_lower)
        aes_score = 5.0 if match_count >= 3 else (4.0 if match_count >= 1 else 2.5)

    scores["aesthetic_relevance"] = aes_score

    # 6. Personalization & Constraint Compliance
    const_score = 4.0
    constraints = prompt_meta.get("constraints", {})

    # Weather/Climate checks
    if "climate" in constraints:
        c_desc = constraints["climate"].lower()
        if "hot" in c_desc or "30c" in c_desc or "32c" in c_desc:
            if re.search(r"\b(wool|heavy\s+coat|fleece|turtleneck|down\s+jacket)\b", text_lower):
                const_score -= 2.0
                diagnostics.append("Recommended heavy winter garments for hot tropical climate")
            elif re.search(r"\b(linen|cotton|breathable|lightweight|poplin|sandals)\b", text_lower):
                const_score += 0.5
        elif "snow" in c_desc or "sub-zero" in c_desc or "-8c" in c_desc or "-10c" in c_desc:
            if re.search(r"\b(shorts|sandals|crop\s+top|tank\s+top|t-shirt\s+alone)\b", text_lower):
                const_score -= 2.0
                diagnostics.append("Recommended summer pieces for sub-zero snowy climate")
            elif re.search(r"\b(wool|cashmere|shearling|coat|thermal|boots|layering)\b", text_lower):
                const_score += 0.5

    # Budget checks
    if "budget" in constraints:
        b_desc = constraints["budget"].lower()
        if "thrift" in b_desc or "$45" in b_desc:
            if re.search(r"\b(thrift|vintage|second-hand|affordable|budget|staples|swap)\b", text_lower):
                const_score += 0.5
            elif re.search(r"\b(designer|luxury|cashmere|bespoke)\b", text_lower):
                const_score -= 1.5
                diagnostics.append("Recommended luxury items on a strict $45 thrift budget")

    # Conflict handling
    if prompt_meta.get("is_conflict"):
        # Expect the model to constructively address the contradiction rather than blindly pairing them
        addresses_conflict = bool(re.search(r"\b(conflict|cannot|however|instead|tension|alternative|dress\s+code|resolve|balance|substitute)\b", text_lower))
        if addresses_conflict:
            const_score = 4.5
        else:
            const_score = 1.5
            diagnostics.append("Failed to recognize or address conflicting user constraints")

    # Underspecified handling
    if prompt_meta.get("is_underspecified"):
        asks_clarifying = bool(re.search(r"\b(which|what|tell\s+me|depends\s+on|weather|occasion|style|clarify|\?)\b", text_lower))
        provides_structure = bool(re.search(r"\b(here\s+are\s+a\s+few|option\s+1|versatile|baseline)\b", text_lower))
        if asks_clarifying or provides_structure:
            const_score = 4.5
        else:
            const_score = 2.5
            diagnostics.append("Made rigid assumptions without clarifying underspecified request")

    scores["constraint_compliance"] = max(1.0, min(5.0, round(const_score, 1)))

    # 7. Diversity and Structure
    div_score = 4.0
    has_numbered_list = bool(re.search(r"^\s*\d+[\.\)]\s+", response_text, re.M))
    has_headers = bool(re.search(r"^\s*(\*\*|#|look\s+\d|option\s+\d)", response_text, re.M | re.I))

    if has_numbered_list or has_headers:
        div_score = 4.5
    else:
        div_score = 3.0
        diagnostics.append("Lacks structured bullet points or clean section formatting")

    # Check for wandering/rambling (repeating same item or abrupt topic shifts)
    lines = [l.strip() for l in response_text.splitlines() if l.strip()]
    if len(lines) > 12 and not has_headers:
        div_score -= 1.0
        diagnostics.append("Overly rambling list without clear grouping")

    scores["diversity_and_structure"] = max(1.0, min(5.0, round(div_score, 1)))

    # 8. Practicality
    pract_score = 4.0
    if scores["coherence"] <= 2.5 or scores["constraint_compliance"] <= 2.5:
        pract_score = min(pract_score, 2.5)
    else:
        pract_score = 4.5
    scores["practicality"] = pract_score

    # 9. Trend Reliability & Transparency
    is_trend_query = prompt_meta.get("is_trend_query", False)
    if is_trend_query:
        # Check for transparency vs hallucinated certainty
        shows_transparency = bool(re.search(r"\b(knowledge\s+cutoff|as\s+of|live\s+data|trend\s+forecasting|timeless|shifting|classic|verify|subjective)\b", text_lower))
        hallucinates_facts = bool(re.search(r"\b(according\s+to\s+(this\s+week's|the\s+2026\s+vogue|official\s+2026)|everyone\s+is\s+buying|verified\s+data\s+shows)\b", text_lower))
        
        if shows_transparency and not hallucinates_facts:
            trend_score = 5.0
        elif not hallucinates_facts:
            trend_score = 3.5
        else:
            trend_score = 1.5
            diagnostics.append("Fabricated unsubstantiated 2026 trend or source claims")
    else:
        # Penalize injecting random fake trend claims when not asked
        unprompted_trend_claim = bool(re.search(r"\b(trending\s+on\s+tiktok\s+this\s+week|2026\s+official\s+trend)\b", text_lower))
        if unprompted_trend_claim:
            trend_score = 2.5
            diagnostics.append("Injected unprompted viral trend claims")
        else:
            trend_score = 5.0

    scores["trend_reliability"] = trend_score

    # 10. Gender & Clothing-Category Compliance
    target_gender = prompt_meta.get("target_gender", "unspecified")
    gender_score = 4.5

    if target_gender == "men":
        women_items = re.findall(r"\b(blouse|skirt|dress|heels|stilettos|halter\s+top|corset|camisole|bra\s+top)\b", text_lower)
        if women_items and "skirt" not in prompt_meta.get("prompt", "").lower():
            gender_score = 1.5
            diagnostics.append(f"Recommended conventional women's items for explicit men's prompt: {set(women_items)}")
        else:
            gender_score = 5.0
    elif target_gender == "women":
        # Check that it fits women's clothing
        men_terms = re.findall(r"\b(menswear|necktie|men's\s+suit|boxer\s+briefs)\b", text_lower)
        if men_terms and "menswear" not in prompt_meta.get("prompt", "").lower():
            gender_score = 2.5
            diagnostics.append(f"Injected conventional men's items for explicit women's prompt: {set(men_terms)}")
        else:
            gender_score = 5.0
    elif target_gender == "androgynous":
        hyper_gender = re.findall(r"\b(feminine\s+curves|manly|ladylike|girly|masculine\s+physique)\b", text_lower)
        if hyper_gender:
            gender_score = 2.5
            diagnostics.append(f"Used gendered bodily commentary for androgynous prompt: {set(hyper_gender)}")
        else:
            gender_score = 5.0
    elif target_gender == "non_conventional":
        # e.g. Man requesting a skirt, or Woman requesting menswear suit
        # Check if model respected the non-conventional item without refusing or adding derogatory remarks
        if "skirt" in prompt_meta.get("prompt", "").lower():
            if "skirt" in text_lower:
                gender_score = 5.0
            else:
                gender_score = 1.5
                diagnostics.append("Failed to style requested skirt for male user")
        elif "menswear" in prompt_meta.get("prompt", "").lower():
            if re.search(r"\b(suit|blazer|trousers|tailored)\b", text_lower):
                gender_score = 5.0
            else:
                gender_score = 2.0
                diagnostics.append("Failed to style requested menswear suit for female user")
    elif target_gender == "unspecified":
        # Should not make rigid assumptions like 'As a woman, wear...'
        assumes = re.search(r"\b(for\s+the\s+lady|for\s+men\s+only|as\s+a\s+woman\s+you|as\s+a\s+man\s+you)\b", text_lower)
        if assumes:
            gender_score = 2.5
            diagnostics.append("Assumed specific user gender when gender was unspecified")
        else:
            gender_score = 4.5

    scores["gender_compliance"] = gender_score

    return scores, diagnostics

def run_evaluation(model_name: str, prompts_path: str, system_prompt: str = None, options: dict = None, output_path: str = None):
    with open(prompts_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"\n=======================================================")
    print(f"Starting Evaluation for Model: {model_name}")
    print(f"Total Test Prompts: {len(prompts)}")
    if options:
        print(f"Generation Options: {options}")
    print(f"=======================================================\n")

    results = []
    dimension_sums = {
        "coherence": 0.0,
        "palette_consistency": 0.0,
        "accessories_coordination": 0.0,
        "fit_and_silhouette": 0.0,
        "aesthetic_relevance": 0.0,
        "constraint_compliance": 0.0,
        "diversity_and_structure": 0.0,
        "practicality": 0.0,
        "trend_reliability": 0.0,
        "gender_compliance": 0.0
    }
    failure_count = 0

    for idx, p_meta in enumerate(prompts):
        pid = p_meta["id"]
        cat = p_meta["category"]
        p_text = p_meta["prompt"]

        print(f"[{idx+1}/{len(prompts)}] Evaluating {pid} ({cat})...", end=" ", flush=True)

        res = query_ollama(model_name, p_text, system=system_prompt, options=options)
        if res["error"]:
            print(f"FAILED (Ollama error: {res['error']})")
            failure_count += 1
            scores = {k: 1.0 for k in dimension_sums}
            diags = [f"Ollama execution error: {res['error']}"]
        else:
            scores, diags = score_response(p_meta, res["response"])
            total_prompt_score = sum(scores.values()) / len(scores)
            is_failure = total_prompt_score < 2.8 or scores["coherence"] < 2.5
            if is_failure:
                failure_count += 1
                status = f"FLAGGED ({total_prompt_score:.2f}/5.0)"
            else:
                status = f"OK ({total_prompt_score:.2f}/5.0)"
            print(f"{status} in {res['latency_sec']}s")

        for dim, val in scores.items():
            dimension_sums[dim] += val

        record = {
            "prompt_id": pid,
            "category": cat,
            "prompt": p_text,
            "target_gender": p_meta.get("target_gender"),
            "aesthetic": p_meta.get("aesthetic"),
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "eval_count": res.get("eval_count", 0),
            "scores": scores,
            "overall_prompt_score": round(sum(scores.values()) / len(scores), 2),
            "diagnostics": diags,
            "error": res["error"]
        }
        results.append(record)

    total_prompts = len(prompts)
    means = {dim: round(total / total_prompts, 2) for dim, total in dimension_sums.items()}
    overall_mean = round(sum(means.values()) / len(means), 2)
    failure_rate = round((failure_count / total_prompts) * 100, 1)

    summary = {
        "model_name": model_name,
        "evaluated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_prompts": total_prompts,
        "failure_count": failure_count,
        "failure_rate_pct": failure_rate,
        "dimension_means": means,
        "overall_mean_score": overall_mean,
        "options": options,
        "system_prompt": system_prompt,
        "results": results
    }

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"\n[OK] Saved evaluation results to: {output_path}")

    # Print summary table
    print("\n" + "="*50)
    print(f"EVALUATION SUMMARY: {model_name}")
    print("="*50)
    for dim, score in means.items():
        print(f"  - {dim.replace('_', ' ').title():<32}: {score:.2f} / 5.0")
    print("-" * 50)
    print(f"  >> OVERALL SCORE                 : {overall_mean:.2f} / 5.0")
    print(f"  >> FAILURE RATE                  : {failure_rate}% ({failure_count}/{total_prompts})")
    print("="*50 + "\n")

    return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run NOVA Fashion AI Evaluation Suite")
    parser.add_argument("--model", default="nova-fashion", help="Name of Ollama model to evaluate")
    parser.add_argument("--prompts", default="fashion_ai/evaluation/eval_prompts.json", help="Path to prompts JSON file")
    parser.add_argument("--output", default="fashion_ai/evaluation/eval_results.json", help="Path to output JSON")
    parser.add_argument("--temperature", type=float, default=None, help="Generation temperature")
    parser.add_argument("--top_p", type=float, default=None, help="Generation top_p")
    parser.add_argument("--repeat_penalty", type=float, default=None, help="Repetition penalty")
    args = parser.parse_args()

    opts = {}
    if args.temperature is not None:
        opts["temperature"] = args.temperature
    if args.top_p is not None:
        opts["top_p"] = args.top_p
    if args.repeat_penalty is not None:
        opts["repeat_penalty"] = args.repeat_penalty

    run_evaluation(
        model_name=args.model,
        prompts_path=args.prompts,
        options=opts if opts else None,
        output_path=args.output
    )
