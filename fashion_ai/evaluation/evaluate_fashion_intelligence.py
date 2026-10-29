#!/usr/bin/env python3
"""
Deep Fashion Intelligence & Knowledge Evaluation Engine for NOVA.
Measures true sartorial quality across 10 specialized dimensions:
1. Outfit Coherence & Wearability
2. Palette Consistency & Color Harmony
3. Silhouette & Proportion Quality
4. Fabric & Texture Compatibility
5. Footwear & Accessory Coordination
6. Aesthetic Authenticity & Relevance
7. Gender & Category Compliance
8. Personalization & Constraint Satisfaction
9. Practicality & Climate Realism
10. Trend Truthfulness & Evidence Integrity
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

FABRICS = [
    "wool", "cashmere", "linen", "cotton", "denim", "silk", "satin", "leather",
    "suede", "corduroy", "tweed", "flannel", "chambray", "poplin", "chiffon",
    "shearling", "fleece", "nylon", "canvas", "velvet", "twill", "modal"
]

SILHOUETTES = [
    "wide-leg", "straight-leg", "oversized", "tailored", "relaxed", "boxy",
    "high-waisted", "high-rise", "tapered", "cropped", "pleated", "draped",
    "unstructured", "drop-shoulder", "slim-fit", "column", "a-line"
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

def score_fashion_intelligence(prompt_meta: dict, response_text: str):
    scores = {}
    diagnostics = []
    text_lower = response_text.lower()
    word_count = len(response_text.split())

    if not response_text.strip() or word_count < 20:
        return {k: 1.0 for k in [
            "coherence_wearability", "palette_consistency", "silhouette_proportion",
            "fabric_texture_compatibility", "footwear_accessory_coordination",
            "aesthetic_authenticity", "gender_compliance", "constraint_satisfaction",
            "practicality_climate", "trend_truthfulness"
        ]}, ["Empty or extremely short response (<20 words)."]

    # 1. Outfit Coherence & Wearability
    coherence = 4.0
    for np in NONSENSE_PHRASES:
        if re.search(np, text_lower):
            coherence -= 1.5
            diagnostics.append(f"Awkward/hallucinated phrase: '{np}'")
    
    # Anatomical positioning checks (e.g. shoe as bottom or shorts as top)
    if re.search(r"top:\s*(denim\s+shorts?|pants?|jeans|trousers|sandals?|shoes?)", text_lower):
        coherence -= 2.0
        diagnostics.append("Garment misplaced in wrong anatomical section (bottom/shoes as top)")
    if re.search(r"bottom:\s*(sandals?|shoes?|boots?|sneakers?)", text_lower):
        coherence -= 2.0
        diagnostics.append("Garment misplaced in wrong anatomical section (shoes as bottom)")

    has_top = bool(re.search(r"\b(shirt|blouse|tee|top|knit|sweater|polo|hoodie|jacket|blazer|tank|vest|coat)\b", text_lower))
    has_bottom = bool(re.search(r"\b(trousers|pants|jeans|skirt|shorts|chinos|cargos|slacks|kilt|dress)\b", text_lower))
    has_shoes = bool(re.search(r"\b(sneakers|boots|loafers|sandals|shoes|mules|derbies|oxfords|slides|heels)\b", text_lower))

    if not (has_top and has_bottom and has_shoes):
        coherence -= 1.0
        diagnostics.append("Incomplete ensemble missing essential top/bottom/shoes anchor")

    scores["coherence_wearability"] = max(1.0, min(5.0, round(coherence, 1)))

    # 2. Palette Consistency & Color Harmony
    palette_score = 4.0
    exp_colors = prompt_meta.get("expected_palette", [])
    if exp_colors:
        matched = 0
        for exp in exp_colors:
            clean_exp = exp.replace("Option 1:", "").replace("Option 2:", "").strip().lower()
            tokens = [t.strip() for t in re.split(r"[/,]", clean_exp) if t.strip()]
            if any(t in text_lower for t in tokens):
                matched += 1
        ratio = matched / len(exp_colors)
        if ratio >= 0.7:
            palette_score = 5.0
        elif ratio >= 0.4:
            palette_score = 4.0
        elif ratio > 0.1:
            palette_score = 3.0
            diagnostics.append("Partially missed specified color palette")
        else:
            palette_score = 2.0
            diagnostics.append("Failed to feature requested color palette")
    
    # Check for color rationale / 60-30-10 awareness
    if re.search(r"\b(60-30-10|dominant|accent|neutral|contrast|monochrome|analogous|earth\s+tone)\b", text_lower):
        palette_score = min(5.0, palette_score + 0.5)

    scores["palette_consistency"] = max(1.0, min(5.0, round(palette_score, 1)))

    # 3. Silhouette & Proportion Quality
    sil_score = 3.0
    found_silhouettes = [s for s in SILHOUETTES if s in text_lower]
    if len(found_silhouettes) >= 3:
        sil_score += 1.5
    elif len(found_silhouettes) >= 1:
        sil_score += 1.0

    # Reward volume balance explanations (tuck, cuff, cropped, balance)
    if re.search(r"\b(tuck|half-tuck|cuff|balance|elongat|proport|drape|waistline|ratio)\b", text_lower):
        sil_score += 0.5
    else:
        diagnostics.append("Lacks specific silhouette balancing or proportion guidance")

    scores["silhouette_proportion"] = max(1.0, min(5.0, round(sil_score, 1)))

    # 4. Fabric & Texture Compatibility
    fab_score = 3.0
    found_fabrics = [f for f in FABRICS if re.search(rf"\b{f}\b", text_lower)]
    if len(found_fabrics) >= 3:
        fab_score = 4.5
    elif len(found_fabrics) >= 2:
        fab_score = 4.0
    elif len(found_fabrics) == 1:
        fab_score = 3.0
    else:
        fab_score = 2.0
        diagnostics.append("Lacks specific fabric/material identification")

    if re.search(r"\b(texture|tactile|sheen|matte|weight|weave|breathable|durable)\b", text_lower):
        fab_score = min(5.0, fab_score + 0.5)

    scores["fabric_texture_compatibility"] = max(1.0, min(5.0, round(fab_score, 1)))

    # 5. Footwear & Accessory Coordination
    fa_score = 3.5
    if has_shoes:
        fa_score += 0.5
    has_acc = bool(re.search(r"\b(bag|tote|belt|watch|jewelry|earrings|necklace|cap|beanie|scarf|sunglasses|glasses)\b", text_lower))
    if has_acc:
        fa_score += 0.5
    
    # Penalize random metal clashing
    if "silver" in text_lower and "gold" in text_lower and not re.search(r"\b(mixed|contrast|two-tone)\b", text_lower):
        fa_score -= 0.5
        diagnostics.append("Mixed gold and silver metals arbitrarily")

    # Reward hardware/leather matching
    if re.search(r"\b(match|hardware|brass|coordinat|finish)\b", text_lower):
        fa_score = min(5.0, fa_score + 0.5)

    scores["footwear_accessory_coordination"] = max(1.0, min(5.0, round(fa_score, 1)))

    # 6. Aesthetic Authenticity & Relevance
    aes_score = 4.0
    aes = prompt_meta.get("aesthetic", "").lower()
    if "clean_girl" in aes:
        cues = ["sleek", "neutral", "gold", "linen", "slick", "minimal", "dewy", "fresh", "ecru"]
        aes_score = 5.0 if sum(1 for c in cues if c in text_lower) >= 3 else 3.5
    elif "minimalist" in aes or "monochrome" in aes:
        cues = ["clean lines", "monochrome", "understated", "tailored", "charcoal", "unembellished", "capsule"]
        aes_score = 5.0 if sum(1 for c in cues if c in text_lower) >= 3 else 3.5
    elif "streetwear" in aes or "gorpcore" in aes:
        cues = ["boxy", "sneakers", "oversized", "baggy", "canvas", "dropped", "suede", "utilitarian"]
        aes_score = 5.0 if sum(1 for c in cues if c in text_lower) >= 3 else 3.5
    elif "semi_formal" in aes or "black_tie" in aes or "tailoring" in aes:
        cues = ["tailored", "hopsack", "blazer", "trousers", "cuffs", "loafers", "dress", "oxford"]
        aes_score = 5.0 if sum(1 for c in cues if c in text_lower) >= 3 else 3.5

    scores["aesthetic_authenticity"] = max(1.0, min(5.0, round(aes_score, 1)))

    # 7. Gender & Category Compliance
    target_gender = prompt_meta.get("target_gender", "universal")
    gen_score = 5.0
    if target_gender == "men":
        fem_terms = re.findall(r"\b(gown|dress|blouse|skirt|heels|stilettos|corset|camisole)\b", text_lower)
        if fem_terms and "skirt" not in prompt_meta.get("prompt", "").lower():
            gen_score = 1.5
            diagnostics.append(f"Introduced conventional female items for men's prompt: {set(fem_terms)}")
    elif target_gender == "women":
        if re.search(r"\b(menswear|necktie|boxers)\b", text_lower) and "menswear" not in prompt_meta.get("prompt", "").lower():
            gen_score = 2.5
            diagnostics.append("Introduced men's shirting/underwear terms for women's prompt")
    elif target_gender == "non_conventional":
        if "skirt" in prompt_meta.get("prompt", "").lower() or "kilt" in prompt_meta.get("prompt", "").lower():
            if re.search(r"\b(skirt|kilt)\b", text_lower):
                gen_score = 5.0
            else:
                gen_score = 1.5
                diagnostics.append("Failed to style requested non-conventional skirt/kilt")
        elif "menswear" in prompt_meta.get("prompt", "").lower():
            if re.search(r"\b(suit|blazer|trousers)\b", text_lower):
                gen_score = 5.0
            else:
                gen_score = 2.0
                diagnostics.append("Failed to style requested menswear suit for woman")

    scores["gender_compliance"] = max(1.0, min(5.0, round(gen_score, 1)))

    # 8. Personalization & Constraint Satisfaction
    const_score = 4.0
    constraints = prompt_meta.get("constraints", {})

    # Negative constraints check
    if "negative_constraints" in constraints:
        for neg in constraints["negative_constraints"]:
            raw_item = neg.replace("NO", "").strip().lower()
            if re.search(rf"\b{raw_item}\b", text_lower):
                const_score -= 2.0
                diagnostics.append(f"VIOLATED NEGATIVE CONSTRAINT: recommended forbidden item '{raw_item}'")

    # Conflict check
    if prompt_meta.get("is_conflict"):
        if re.search(r"\b(conflict|contradict|tension|cannot|instead|however|alternative|compromise|substitute|dress code)\b", text_lower):
            const_score = min(5.0, const_score + 1.0)
        else:
            const_score = 1.5
            diagnostics.append("Failed to identify and address conflicting constraints")

    # Underspecified check
    if prompt_meta.get("is_underspecified"):
        if re.search(r"\b(\?|clarify|depends on|which|what occasion|tell me|weather|preferences)\b", text_lower):
            const_score = min(5.0, const_score + 1.0)
        else:
            const_score = 2.0
            diagnostics.append("Failed to ask clarifying questions for underspecified prompt")

    scores["constraint_satisfaction"] = max(1.0, min(5.0, round(const_score, 1)))

    # 9. Practicality & Climate Realism
    prac_score = 4.0
    p_text = prompt_meta.get("prompt", "").lower()

    if "34c" in p_text or "32c" in p_text or "humid" in p_text or "tropical" in p_text or "heatwave" in p_text:
        if re.search(r"\b(heavy\s+wool|velvet|shearling|fleece|down\s+coat|turtleneck|heavy\s+knit)\b", text_lower):
            prac_score -= 2.0
            diagnostics.append("Recommended heavy winter fabrics in tropical heatwave")
        elif re.search(r"\b(linen|poplin|seersucker|tropical|breathable|lightweight)\b", text_lower):
            prac_score += 0.5
    elif "sub-zero" in p_text or "-8c" in p_text or "-10c" in p_text or "snow" in p_text:
        if re.search(r"\b(shorts|sandals|tank\s+top|crop\s+top|open-toe)\b", text_lower):
            prac_score -= 2.0
            diagnostics.append("Recommended summer shorts/sandals in sub-zero snow")
        elif re.search(r"\b(cashmere|wool|shearling|boots|down|insulated|thermal)\b", text_lower):
            prac_score += 0.5

    scores["practicality_climate"] = max(1.0, min(5.0, round(prac_score, 1)))

    # 10. Trend Truthfulness & Evidence Integrity
    is_trend_query = prompt_meta.get("is_trend_query", False)
    if is_trend_query or "demands_fake_data" in constraints:
        # Check for transparency vs fabricated citations
        claims_fake_citations = bool(re.search(r"\b(according to the 2026|official 2026 data shows|verified statistics prove|in 2026 vogue reported)\b", text_lower))
        acknowledges_limits = bool(re.search(r"\b(as an ai|knowledge (cutoff|limits)|without (live|real-time)|macro|timeless|cannot cite|predict)\b", text_lower))

        if acknowledges_limits and not claims_fake_citations:
            trend_score = 5.0
        elif not claims_fake_citations:
            trend_score = 3.5
        else:
            trend_score = 1.0
            diagnostics.append("Fabricated false 2026 citations or sales data")
    else:
        trend_score = 5.0

    scores["trend_truthfulness"] = trend_score

    return scores, diagnostics

def run_fashion_eval(model_name: str, prompts_path: str, output_path: str = None, options: dict = None, system: str = None):
    with open(prompts_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"\n=======================================================")
    print(f"DEEP FASHION INTELLIGENCE EVALUATION")
    print(f"Model: {model_name}")
    print(f"Suite: {prompts_path} ({len(prompts)} prompts)")
    print(f"=======================================================\n")

    results = []
    dimension_sums = {
        "coherence_wearability": 0.0,
        "palette_consistency": 0.0,
        "silhouette_proportion": 0.0,
        "fabric_texture_compatibility": 0.0,
        "footwear_accessory_coordination": 0.0,
        "aesthetic_authenticity": 0.0,
        "gender_compliance": 0.0,
        "constraint_satisfaction": 0.0,
        "practicality_climate": 0.0,
        "trend_truthfulness": 0.0
    }
    failure_count = 0

    for idx, p_meta in enumerate(prompts):
        pid = p_meta["id"]
        cat = p_meta["category"]
        p_text = p_meta["prompt"]

        print(f"[{idx+1}/{len(prompts)}] {pid} ({cat})...", end=" ", flush=True)
        res = query_ollama(model_name, p_text, system=system, options=options)

        if res["error"]:
            print(f"FAILED ({res['error']})")
            failure_count += 1
            scores = {k: 1.0 for k in dimension_sums}
            diags = [f"Ollama error: {res['error']}"]
        else:
            scores, diags = score_fashion_intelligence(p_meta, res["response"])
            overall = sum(scores.values()) / len(scores)
            if overall < 3.0 or scores["coherence_wearability"] < 2.5:
                failure_count += 1
                status = f"FLAGGED ({overall:.2f}/5.0)"
            else:
                status = f"OK ({overall:.2f}/5.0)"
            print(f"{status} in {res['latency_sec']}s")

        for d, v in scores.items():
            dimension_sums[d] += v

        results.append({
            "prompt_id": pid,
            "category": cat,
            "prompt": p_text,
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "scores": scores,
            "overall_prompt_score": round(sum(scores.values()) / len(scores), 2),
            "diagnostics": diags,
            "error": res["error"]
        })

    total = len(prompts)
    means = {d: round(s / total, 2) for d, s in dimension_sums.items()}
    overall_mean = round(sum(means.values()) / len(means), 2)
    failure_rate = round((failure_count / total) * 100, 1)

    summary = {
        "model_name": model_name,
        "suite_file": prompts_path,
        "total_prompts": total,
        "failure_count": failure_count,
        "failure_rate_pct": failure_rate,
        "dimension_means": means,
        "overall_mean_score": overall_mean,
        "results": results
    }

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"\n[OK] Results saved to: {output_path}")

    print("\n" + "="*50)
    print(f"FASHION INTELLIGENCE SCORECARD: {model_name}")
    print("="*50)
    for dim, score in means.items():
        print(f"  - {dim.replace('_', ' ').title():<34}: {score:.2f} / 5.0")
    print("-" * 50)
    print(f"  >> OVERALL FASHION QUALITY SCORE : {overall_mean:.2f} / 5.0")
    print(f"  >> FLAGGED FAILURE RATE          : {failure_rate}% ({failure_count}/{total})")
    print("="*50 + "\n")

    return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Model on Fashion Intelligence")
    parser.add_argument("--model", default="nova-fashion-opt-v3", help="Ollama model name")
    parser.add_argument("--prompts", default="fashion_ai/evaluation/eval_prompts_expanded.json", help="Prompts file")
    parser.add_argument("--output", default="fashion_ai/evaluation/intelligence_v3_expanded.json", help="Output file")
    args = parser.parse_args()

    run_fashion_eval(
        model_name=args.model,
        prompts_path=args.prompts,
        output_path=args.output
    )
