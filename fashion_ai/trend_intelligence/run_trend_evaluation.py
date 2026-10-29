#!/usr/bin/env python3
"""
Comprehensive Before & After Evaluation Harness for Gen Z Fashion Intelligence & Live Trends
Compares:
Condition 1 (BEFORE): Current Structured 1.5B Candidate without Trend Retrieval
Condition 2 (AFTER):  Current Structured 1.5B Candidate with Grounded Trend Retrieval
Across 32 diverse Gen Z, Indian fusion, aesthetic, and factual trend prompts.
"""

import json
import os
import sys
import time
import re
from typing import Dict, Any, List, Tuple

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCHMARK_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "evaluation", "stronger_model_benchmark"))
if BENCHMARK_DIR not in sys.path:
    sys.path.insert(0, BENCHMARK_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from isolated_curator_adapter import curate_structured_outfit
from trend_grounded_curator import curate_with_trend_grounding, ALL_TRENDS
from constraint_checker import extract_constraints, check_outfit_constraints

PROMPTS_PATH = os.path.join(CURRENT_DIR, "eval_prompts_genz_trends.json")
RESULTS_PATH = os.path.join(CURRENT_DIR, "trend_eval_results.json")

def score_trend_curation(prompt_meta: dict, result: dict) -> Tuple[Dict[str, float], List[str]]:
    """
    Scores outfit or factual trend response across 7 specialized dimensions.
    Crucially: Does NOT penalize factual trend queries for missing garment slots!
    """
    scores = {}
    diagnostics = []
    
    is_factual = prompt_meta.get("is_factual_query", False)
    data = result.get("data") or {}
    text_repr = json.dumps(data).lower() if data else ""
    rationale = str(data.get("styling_rationale", "")).lower()
    
    # 1. Factual Trend Grounding & Provenance (1.0 to 5.0)
    grounding_score = 3.0
    if result.get("metadata", {}).get("trend_grounded"):
        grounding_score = 4.5
        matched = result.get("metadata", {}).get("matched_trends", [])
        if any(t in str(matched) for t in ["Barrel-Leg", "Butter Yellow", "Mesh", "Retro Runners", "Kurti", "Oxidised", "Ajrakh"]):
            grounding_score = 5.0
    else:
        # Check if response spontaneously hallucinated fake citations
        if re.search(r"\b(according to the 2026 runway|vogue confirmed in 2026|official runway data proves)\b", rationale):
            grounding_score = 1.0
            diagnostics.append("Hallucinated fake future runway citation")
        elif is_factual and re.search(r"\b(last update|early 2024|cannot cite|as an ai|directional)\b", rationale):
            grounding_score = 4.5
        else:
            grounding_score = 3.0
    scores["factual_trend_grounding"] = grounding_score

    # 2. Aesthetic Differentiation (1.0 to 5.0)
    target_aesthetic = prompt_meta.get("target_aesthetic", "").lower().replace("_", " ")
    aes_score = 3.5
    expected_elements = prompt_meta.get("expected_elements", [])
    matched_elems = sum(1 for e in expected_elements if any(word in text_repr for word in e.lower().split()))
    if expected_elements:
        ratio = matched_elems / len(expected_elements)
        if ratio >= 0.7:
            aes_score = 5.0
        elif ratio >= 0.4:
            aes_score = 4.0
        else:
            aes_score = 2.5
            diagnostics.append("Weak aesthetic differentiation for " + target_aesthetic)
    scores["aesthetic_differentiation"] = aes_score

    # 3. Regional & Climate Practicality (1.0 to 5.0)
    clim_score = 4.0
    region = prompt_meta.get("region", "global")
    prompt_text = prompt_meta["prompt"].lower()
    if region == "india" or "mumbai" in prompt_text or "delhi" in prompt_text:
        # Check for Indian textiles / fabrics (mulmul, cotton, chikankari, ajrakh, linen)
        if any(f in text_repr for f in ["cotton", "mulmul", "chikankari", "ajrakh", "linen", "khadi"]):
            clim_score = 5.0
        elif any(f in text_repr for f in ["heavy wool", "tweed", "leather overcoat", "fleece"]):
            clim_score = 1.5
            diagnostics.append("Inappropriate heavy fabric for tropical Indian climate")
    elif "38°c" in prompt_text or "sweltering" in prompt_text:
        if any(f in text_repr for f in ["linen", "cotton", "breathable", "light"]):
            clim_score = 4.5
        if any(f in text_repr for f in ["wool overcoat", "down", "heavy coat"]):
            clim_score = 1.5
            diagnostics.append("Inappropriate heavy outerwear in 38°C heat")
    scores["regional_climate_practicality"] = clim_score

    # 4. Outfit Coherence & Wearability (1.0 to 5.0)
    if is_factual:
        # Factual query: judged on answer clarity rather than garment anchors!
        coh_score = 4.5 if len(rationale) > 40 else 3.0
    else:
        coh_score = 4.0
        top = str(data.get("top", "")).lower()
        bottom = str(data.get("bottom", "")).lower()
        foot = str(data.get("footwear", "")).lower()
        if not (top and bottom and foot):
            coh_score -= 1.5
            diagnostics.append("Incomplete ensemble missing core anchor")
        # Check slot misplacements
        if any(b in top for b in ["trousers", "pants", "skirt", "shorts"]):
            coh_score -= 1.5
            diagnostics.append("Garment misplaced in wrong slot")
    scores["outfit_coherence_wearability"] = max(1.0, min(5.0, coh_score))

    # 5. Constraint Compliance (1.0 to 5.0)
    constraints = extract_constraints(prompt_meta["prompt"])
    is_comp, viols = check_outfit_constraints(data, constraints, prompt_meta["prompt"])
    if is_comp:
        const_score = 5.0
    else:
        const_score = max(1.0, 5.0 - (len(viols) * 1.5))
        diagnostics.extend(viols)
    scores["constraint_compliance"] = const_score

    # 6. Gender & Category Integrity (1.0 to 5.0)
    t_gender = prompt_meta.get("target_gender", "universal")
    is_non_conv = "non_conventional" in prompt_meta.get("category", "") or "skirt" in prompt_text and "man" in prompt_text
    gender_score = 5.0
    if t_gender == "men" and not is_non_conv:
        for fem in ["blouse", "dress", "gown"]:
            if fem in text_repr:
                gender_score = 2.0
                diagnostics.append(f"Introduced female item '{fem}' in menswear")
    scores["gender_integrity"] = gender_score

    # 7. Affordability & Materiality (1.0 to 5.0)
    mat_score = 4.0
    if "under $" in prompt_text or "under ₹" in prompt_text:
        # Check if realistic accessible fabrics mentioned
        if any(af in text_repr for af in ["cotton", "denim", "canvas", "linen", "thrift", "bazaar", "accessible"]):
            mat_score = 5.0
        elif any(lux in text_repr for lux in ["cashmere", "pure silk", "bespoke", "18k solid gold"]):
            mat_score = 2.5
            diagnostics.append("Luxury material suggested in budget-constrained query")
    scores["affordability_materiality"] = mat_score

    return scores, diagnostics

def run_evaluation():
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    total = len(prompts)
    print("=" * 70)
    print(f"NOVA GEN Z & LIVE TREND INTELLIGENCE BENCHMARK ({total} PROMPTS)")
    print("Condition 1: BEFORE (1.5B Structured Baseline - No Trend Retrieval)")
    print("Condition 2: AFTER  (1.5B Structured + Grounded Trend Retrieval)")
    print("=" * 70)

    results_before = []
    results_after = []

    # -------------------------------------------------------------
    # RUN 1: BEFORE (Baseline without Trend Retrieval)
    # -------------------------------------------------------------
    print("\n>>> EVALUATING CONDITION 1: BEFORE (Without Trend Grounding) <<<")
    for idx, p in enumerate(prompts):
        pid = p["id"]
        cat = p["category"]
        print(f"  [Before {idx+1}/{total}] {pid} ({cat})...", end=" ", flush=True)
        res = curate_structured_outfit(p["prompt"])
        scores, diags = score_trend_curation(p, res)
        overall = round(sum(scores.values()) / len(scores), 2)
        duration_s = round(res.get("metadata", {}).get("duration_ms", 0) / 1000, 2)
        
        results_before.append({
            "prompt_id": pid,
            "category": cat,
            "prompt": p["prompt"],
            "status": res["status"],
            "duration_sec": duration_s,
            "scores": scores,
            "overall_score": overall,
            "diagnostics": diags,
            "data": res.get("data")
        })
        print(f"Score: {overall:.2f}/5.0 | Latency: {duration_s}s | Diags: {len(diags)}")

    # -------------------------------------------------------------
    # RUN 2: AFTER (With Grounded Trend Retrieval)
    # -------------------------------------------------------------
    print("\n>>> EVALUATING CONDITION 2: AFTER (With Grounded Trend Retrieval) <<<")
    for idx, p in enumerate(prompts):
        pid = p["id"]
        cat = p["category"]
        print(f"  [After {idx+1}/{total}] {pid} ({cat})...", end=" ", flush=True)
        res = curate_with_trend_grounding(p["prompt"])
        scores, diags = score_trend_curation(p, res)
        overall = round(sum(scores.values()) / len(scores), 2)
        duration_s = round(res.get("metadata", {}).get("duration_ms", 0) / 1000, 2)
        matched_trends = res.get("metadata", {}).get("matched_trends", [])
        sources = res.get("metadata", {}).get("sources_cited", [])

        results_after.append({
            "prompt_id": pid,
            "category": cat,
            "prompt": p["prompt"],
            "status": res["status"],
            "duration_sec": duration_s,
            "scores": scores,
            "overall_score": overall,
            "diagnostics": diags,
            "matched_trends": matched_trends,
            "sources_cited": sources,
            "data": res.get("data")
        })
        print(f"Score: {overall:.2f}/5.0 | Latency: {duration_s}s | Trends: {len(matched_trends)}")

    # -------------------------------------------------------------
    # STATS & CONSOLIDATION
    # -------------------------------------------------------------
    def get_summary_stats(res_list):
        scores = [r["overall_score"] for r in res_list]
        latencies = [r["duration_sec"] for r in res_list]
        latencies_sorted = sorted(latencies)
        n = len(res_list)
        dims = list(res_list[0]["scores"].keys())
        dim_means = {d: round(sum(r["scores"][d] for r in res_list) / n, 2) for d in dims}
        failures = [r for r in res_list if r["overall_score"] < 3.5 or len(r["diagnostics"]) > 2]

        return {
            "overall_mean_score": round(sum(scores) / n, 2),
            "median_score": round(sorted(scores)[n//2], 2),
            "dimension_means": dim_means,
            "failure_rate_pct": round((len(failures) / n) * 100, 1),
            "failure_count": len(failures),
            "mean_latency_sec": round(sum(latencies) / n, 2),
            "median_latency_sec": round(latencies_sorted[n//2], 2),
            "min_latency_sec": round(min(latencies), 2),
            "max_latency_sec": round(max(latencies), 2)
        }

    summary_before = get_summary_stats(results_before)
    summary_after = get_summary_stats(results_after)

    consolidated = {
        "metadata": {
            "title": "NOVA Phase 5 Gen Z & Live Trend Intelligence Benchmark",
            "date": "2026-10-27",
            "model": "nova-fashion-1.5b-benchmark",
            "total_prompts": total
        },
        "summary": {
            "condition_1_before_no_retrieval": summary_before,
            "condition_2_after_with_trend_grounding": summary_after
        },
        "results_before": results_before,
        "results_after": results_after
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(consolidated, f, indent=2)

    print("\n" + "=" * 80)
    print("GEN Z & TREND INTELLIGENCE BENCHMARK RESULTS")
    print("=" * 80)
    print(f"{'METRIC':<36} | {'Condition 1 (BEFORE)':<18} | {'Condition 2 (AFTER)':<18} | {'DELTA':<10}")
    print("-" * 80)
    for dim in summary_before["dimension_means"].keys():
        b = summary_before["dimension_means"][dim]
        a = summary_after["dimension_means"][dim]
        diff = round(a - b, 2)
        diff_str = f"+{diff:.2f}" if diff > 0 else f"{diff:.2f}"
        print(f"{dim:<36} | {b:<18.2f} | {a:<18.2f} | {diff_str:<10}")
    print("-" * 80)
    b_ov = summary_before["overall_mean_score"]
    a_ov = summary_after["overall_mean_score"]
    diff_ov = round(a_ov - b_ov, 2)
    print(f"{'OVERALL MEAN SCORE':<36} | {b_ov:<18.2f} | {a_ov:<18.2f} | {'+' if diff_ov>0 else ''}{diff_ov:.2f}")
    print(f"{'FAILURE RATE (%)':<36} | {summary_before['failure_rate_pct']:<18.1f} | {summary_after['failure_rate_pct']:<18.1f} | {summary_after['failure_rate_pct'] - summary_before['failure_rate_pct']:.1f}%")
    print(f"{'MEAN LATENCY (SEC)':<36} | {summary_before['mean_latency_sec']:<18.2f} | {summary_after['mean_latency_sec']:<18.2f} | {summary_after['mean_latency_sec'] - summary_before['mean_latency_sec']:+.2f}s")
    print("=" * 80 + "\n")
    print(f"[OK] Consolidated evaluation saved to: {RESULTS_PATH}")

if __name__ == "__main__":
    run_evaluation()
