#!/usr/bin/env python3
"""
3-Way Controlled Architectural Benchmark
Compares:
Configuration A: nova-fashion-opt-v4 (0.5B fine-tuned with v4 prompt)
Configuration B: nova-fashion-1.5b-benchmark (1.5B with v4 prompt)
Configuration C: 1.5B Structured Output Prototype with programmatic validation and max 1 retry.

Evaluates 20 frozen prompts covering:
- Negative exclusions (NO black, NO hoodies, NO sneakers)
- Men's, women's, gender-neutral, non-conventional requests
- Climate & humidity (hot weather 34°C formal)
- Formality & dress code compatibility
- Budget & materiality constraints
- Aesthetic distinctiveness
- Trend truthfulness and epistemic limits

Saves all granular outputs, slot accuracy, latency distributions, and retry logs to
fashion_ai/evaluation/stronger_model_benchmark/structured_output_results.json.
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from evaluate_fashion_intelligence import score_fashion_intelligence, query_ollama
from stronger_model_benchmark.output_validator import run_structured_query, validate_outfit_json

BENCHMARK_DIR = os.path.abspath(os.path.dirname(__file__))
PROMPTS_PATH = os.path.join(BENCHMARK_DIR, "hardened_eval_prompts.json")
OUTPUT_PATH = os.path.join(BENCHMARK_DIR, "structured_output_results.json")

def check_slot_accuracy(text_or_json):
    """Programmatically checks whether trousers are in top, shirts in bottom, etc."""
    text_lower = ""
    if isinstance(text_or_json, dict):
        text_lower = json.dumps(text_or_json).lower()
        top_str = str(text_or_json.get("top", "")).lower()
        bot_str = str(text_or_json.get("bottom", "")).lower()
        fw_str = str(text_or_json.get("footwear", "")).lower()
    else:
        text_lower = str(text_or_json).lower()
        top_str = ""
        bot_str = ""
        fw_str = ""
        # Extract from text if formatted
        for line in text_lower.split("\n"):
            if line.startswith("top:"):
                top_str = line
            elif line.startswith("bottom:"):
                bot_str = line
            elif line.startswith("footwear:"):
                fw_str = line

    slot_errors = []
    # Bottoms in top
    for b in ["trousers", "pants", "jeans", "shorts", "skirt", "chinos"]:
        if b in top_str:
            slot_errors.append(f"Bottom item '{b}' in Top slot")
    # Tops in bottom
    for t in ["shirt", "blouse", "tee", "sweater", "hoodie", "blazer", "jacket"]:
        if t in bot_str:
            slot_errors.append(f"Top item '{t}' in Bottom slot")

    return (len(slot_errors) == 0), slot_errors

def run_comparison():
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    total_prompts = len(prompts)
    print(f"============================================================")
    print(f"STARTING 3-WAY FAIR COMPARISON BENCHMARK ({total_prompts} PROMPTS)")
    print(f"============================================================")

    results_config_a = []
    results_config_b = []
    results_config_c = []

    # -------------------------------------------------------------
    # 1. RUN CONFIGURATION A: nova-fashion-opt-v4 (0.5B fine-tuned)
    # -------------------------------------------------------------
    print("\n>>> RUNNING CONFIGURATION A: nova-fashion-opt-v4 (0.5B) <<<")
    for idx, p in enumerate(prompts):
        pid = p["id"]
        print(f"  [Config A {idx+1}/{total_prompts}] {pid}...", end=" ", flush=True)
        res = query_ollama("nova-fashion-opt-v4", p["prompt"], timeout=75)
        scores, diags = score_fashion_intelligence(p, res["response"])
        overall = sum(scores.values()) / len(scores)
        slot_ok, slot_errs = check_slot_accuracy(res["response"])
        
        results_config_a.append({
            "prompt_id": pid,
            "category": p["category"],
            "prompt": p["prompt"],
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "scores": scores,
            "overall_score": round(overall, 2),
            "diagnostics": diags,
            "slot_accuracy": slot_ok,
            "slot_errors": slot_errs,
            "error": res["error"]
        })
        print(f"Score: {overall:.2f}/5.0 | Slot OK: {slot_ok} | Latency: {res['latency_sec']}s")

    # -------------------------------------------------------------
    # 2. RUN CONFIGURATION B: nova-fashion-1.5b-benchmark (standard)
    # -------------------------------------------------------------
    print("\n>>> RUNNING CONFIGURATION B: nova-fashion-1.5b-benchmark (Unstructured) <<<")
    for idx, p in enumerate(prompts):
        pid = p["id"]
        print(f"  [Config B {idx+1}/{total_prompts}] {pid}...", end=" ", flush=True)
        res = query_ollama("nova-fashion-1.5b-benchmark", p["prompt"], timeout=75)
        scores, diags = score_fashion_intelligence(p, res["response"])
        overall = sum(scores.values()) / len(scores)
        slot_ok, slot_errs = check_slot_accuracy(res["response"])

        results_config_b.append({
            "prompt_id": pid,
            "category": p["category"],
            "prompt": p["prompt"],
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "scores": scores,
            "overall_score": round(overall, 2),
            "diagnostics": diags,
            "slot_accuracy": slot_ok,
            "slot_errors": slot_errs,
            "error": res["error"]
        })
        print(f"Score: {overall:.2f}/5.0 | Slot OK: {slot_ok} | Latency: {res['latency_sec']}s")

    # -------------------------------------------------------------
    # 3. RUN CONFIGURATION C: 1.5B Structured Output Prototype
    # -------------------------------------------------------------
    print("\n>>> RUNNING CONFIGURATION C: 1.5B Structured Output Prototype (Validation + <=1 Retry) <<<")
    for idx, p in enumerate(prompts):
        pid = p["id"]
        print(f"  [Config C {idx+1}/{total_prompts}] {pid}...", end=" ", flush=True)
        struct_res = run_structured_query(
            model="nova-fashion-1.5b-benchmark",
            prompt_meta=p,
            options={"temperature": 0.35, "top_p": 0.85},
            max_retries=1
        )
        
        # Score the formatted text output
        text_to_score = struct_res["formatted_text"] if struct_res["formatted_text"] else struct_res["raw_response"]
        scores, diags = score_fashion_intelligence(p, text_to_score)
        overall = sum(scores.values()) / len(scores)
        slot_ok, slot_errs = check_slot_accuracy(struct_res["parsed_json"] if struct_res["parsed_json"] else text_to_score)

        results_config_c.append({
            "prompt_id": pid,
            "category": p["category"],
            "prompt": p["prompt"],
            "raw_response": struct_res["raw_response"],
            "formatted_text": struct_res["formatted_text"],
            "parsed_json": struct_res["parsed_json"],
            "initial_latency_sec": struct_res["initial_latency"],
            "retry_latency_sec": struct_res["retry_latency"],
            "total_latency_sec": struct_res["total_latency"],
            "retry_occurred": struct_res["retry_occurred"],
            "retry_success": struct_res["retry_success"],
            "validation_errors": struct_res["errors"],
            "valid_structured_output": struct_res["valid"],
            "scores": scores,
            "overall_score": round(overall, 2),
            "diagnostics": diags,
            "slot_accuracy": slot_ok,
            "slot_errors": slot_errs
        })
        status_str = f"Score: {overall:.2f}/5.0 | Valid: {struct_res['valid']} | Retry: {struct_res['retry_occurred']} | Total Latency: {struct_res['total_latency']}s"
        print(status_str)

    # -------------------------------------------------------------
    # 4. COMPUTE CONSOLIDATED METRICS & STATS
    # -------------------------------------------------------------
    def get_stats(results, is_struct=False):
        scores = [r["overall_score"] for r in results]
        latencies = [r["total_latency_sec"] if is_struct else r["latency_sec"] for r in results]
        latencies.sort()
        n = len(latencies)
        median_lat = (latencies[n//2] if n % 2 != 0 else (latencies[n//2 - 1] + latencies[n//2]) / 2)
        mean_lat = round(sum(latencies) / n, 2)
        slot_accuracies = [1 if r["slot_accuracy"] else 0 for r in results]
        slot_acc_pct = round((sum(slot_accuracies) / n) * 100, 1)

        # Dimension means
        dims = list(results[0]["scores"].keys())
        dim_means = {d: round(sum(r["scores"][d] for r in results) / n, 2) for d in dims}

        # Failure rate: score < 3.0 or coherence < 2.5
        failures = [r for r in results if r["overall_score"] < 3.0 or r["scores"].get("coherence_wearability", 5.0) < 2.5]
        fail_pct = round((len(failures) / n) * 100, 1)

        stats = {
            "overall_mean_score": round(sum(scores) / n, 2),
            "median_score": round(sorted(scores)[n//2], 2),
            "dimension_means": dim_means,
            "slot_accuracy_pct": slot_acc_pct,
            "failure_rate_pct": fail_pct,
            "failure_count": len(failures),
            "mean_latency_sec": mean_lat,
            "median_latency_sec": round(median_lat, 2),
            "min_latency_sec": round(min(latencies), 2),
            "max_latency_sec": round(max(latencies), 2),
        }

        if is_struct:
            retries = [r for r in results if r.get("retry_occurred")]
            retry_successes = [r for r in results if r.get("retry_success") is True]
            valid_outputs = [r for r in results if r.get("valid_structured_output")]
            stats.update({
                "valid_structured_output_rate_pct": round((len(valid_outputs) / n) * 100, 1),
                "retry_rate_pct": round((len(retries) / n) * 100, 1),
                "retry_count": len(retries),
                "retry_resolution_rate_pct": round((len(retry_successes) / len(retries) * 100), 1) if retries else 100.0,
                "mean_initial_latency_sec": round(sum(r["initial_latency_sec"] for r in results) / n, 2),
                "mean_retry_latency_sec": round(sum(r["retry_latency_sec"] for r in retries) / len(retries), 2) if retries else 0.0
            })

        return stats

    stats_a = get_stats(results_config_a, is_struct=False)
    stats_b = get_stats(results_config_b, is_struct=False)
    stats_c = get_stats(results_config_c, is_struct=True)

    consolidated = {
        "metadata": {
            "evaluation_title": "3-Way Controlled Architectural Benchmark",
            "date": "2026-10-27",
            "prompt_suite": "hardened_eval_prompts.json",
            "total_prompts": total_prompts,
            "retrieval_status": "DISABLED (Pure model capacity and structural evaluation)",
            "hardware": "Intel Iris Xe Graphics (Pure CPU AVX2, 8GB RAM)"
        },
        "configurations_summary": {
            "config_a_opt_v4_0.5b": stats_a,
            "config_b_1.5b_unstructured": stats_b,
            "config_c_1.5b_structured_prototype": stats_c
        },
        "raw_results": {
            "config_a": results_config_a,
            "config_b": results_config_b,
            "config_c": results_config_c
        }
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(consolidated, f, indent=2)

    print(f"\n[OK] 3-Way Benchmark Complete! Consolidated results saved to: {OUTPUT_PATH}")

    # Print comparative scorecard
    print("\n" + "="*80)
    print(f"{'METRIC':<36} | {'Config A (0.5B v4)':<18} | {'Config B (1.5B Unstr)':<20} | {'Config C (1.5B Struct)':<20}")
    print("-"*80)
    print(f"{'Overall Mean Score':<36} | {stats_a['overall_mean_score']:<18.2f} | {stats_b['overall_mean_score']:<20.2f} | {stats_c['overall_mean_score']:<20.2f}")
    print(f"{'Garment Slot Accuracy (%)':<36} | {stats_a['slot_accuracy_pct']:<18.1f} | {stats_b['slot_accuracy_pct']:<20.1f} | {stats_c['slot_accuracy_pct']:<20.1f}")
    print(f"{'Flagged Failure Rate (%)':<36} | {stats_a['failure_rate_pct']:<18.1f} | {stats_b['failure_rate_pct']:<20.1f} | {stats_c['failure_rate_pct']:<20.1f}")
    print(f"{'Mean Latency (sec)':<36} | {stats_a['mean_latency_sec']:<18.2f} | {stats_b['mean_latency_sec']:<20.2f} | {stats_c['mean_latency_sec']:<20.2f}")
    print(f"{'Median Latency (sec)':<36} | {stats_a['median_latency_sec']:<18.2f} | {stats_b['median_latency_sec']:<20.2f} | {stats_c['median_latency_sec']:<20.2f}")
    print(f"{'Valid Structured Rate (%)':<36} | {'N/A (Freeform)':<18} | {'N/A (Freeform)':<20} | {stats_c.get('valid_structured_output_rate_pct', 0):<20.1f}")
    print(f"{'Retry Rate (%)':<36} | {'N/A':<18} | {'N/A':<20} | {stats_c.get('retry_rate_pct', 0):<20.1f}")
    print("="*80 + "\n")

if __name__ == "__main__":
    run_comparison()
