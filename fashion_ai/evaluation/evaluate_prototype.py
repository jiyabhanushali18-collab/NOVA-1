#!/usr/bin/env python3
"""
Evaluate the Grounded Fashion Intelligence Prototype on both suites:
1. Deep Fashion Intelligence Suite (16 prompts)
2. Regression Suite (32 prompts)
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from fashion_ai.prototype.grounded_curator import GroundedCurator
from fashion_ai.evaluation.evaluate_fashion_intelligence import score_fashion_intelligence
from fashion_ai.evaluation.evaluate_model import score_response as score_regression_response

def evaluate_prototype_expanded(curator: GroundedCurator, prompts_path: str, output_path: str):
    with open(prompts_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"\n=======================================================")
    print(f"EVALUATING GROUNDED PROTOTYPE ON EXPANDED SUITE ({len(prompts)} prompts)")
    print(f"Base Model: {curator.model_name}")
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
        res = curator.curate(p_text)

        if res["error"]:
            print(f"FAILED ({res['error']})")
            failure_count += 1
            scores = {k: 1.0 for k in dimension_sums}
            diags = [f"Prototype error: {res['error']}"]
        else:
            scores, diags = score_fashion_intelligence(p_meta, res["response"])
            overall = sum(scores.values()) / len(scores)
            if overall < 3.0 or scores["coherence_wearability"] < 2.5:
                failure_count += 1
                status = f"FLAGGED ({overall:.2f}/5.0)"
            else:
                status = f"OK ({overall:.2f}/5.0)"
            print(f"{status} in {res['latency_sec']}s [Ref: {res['retrieval_curation_id']}]")

        for d, v in scores.items():
            dimension_sums[d] += v

        results.append({
            "prompt_id": pid,
            "category": cat,
            "prompt": p_text,
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "retrieval_curation_id": res.get("retrieval_curation_id"),
            "retrieval_principles": res.get("retrieval_principles"),
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
        "model_name": f"grounded-prototype-{curator.model_name}",
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
    print(f"PROTOTYPE FASHION SCORECARD (EXPANDED)")
    print("="*50)
    for dim, score in means.items():
        print(f"  - {dim.replace('_', ' ').title():<34}: {score:.2f} / 5.0")
    print("-" * 50)
    print(f"  >> OVERALL FASHION QUALITY SCORE : {overall_mean:.2f} / 5.0")
    print(f"  >> FLAGGED FAILURE RATE          : {failure_rate}% ({failure_count}/{total})")
    print("="*50 + "\n")

    return summary

def evaluate_prototype_regression(curator: GroundedCurator, prompts_path: str, output_path: str):
    with open(prompts_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"\n=======================================================")
    print(f"EVALUATING GROUNDED PROTOTYPE ON REGRESSION SUITE ({len(prompts)} prompts)")
    print(f"Base Model: {curator.model_name}")
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

        print(f"[{idx+1}/{len(prompts)}] {pid} ({cat})...", end=" ", flush=True)
        res = curator.curate(p_text)

        if res["error"]:
            print(f"FAILED ({res['error']})")
            failure_count += 1
            scores = {k: 1.0 for k in dimension_sums}
            diags = [f"Prototype error: {res['error']}"]
        else:
            scores, diags = score_regression_response(p_meta, res["response"])
            overall = sum(scores.values()) / len(scores)
            if overall < 2.8 or scores["coherence"] < 2.5:
                failure_count += 1
                status = f"FLAGGED ({overall:.2f}/5.0)"
            else:
                status = f"OK ({overall:.2f}/5.0)"
            print(f"{status} in {res['latency_sec']}s [Ref: {res['retrieval_curation_id']}]")

        for d, v in scores.items():
            dimension_sums[d] += v

        results.append({
            "prompt_id": pid,
            "category": cat,
            "prompt": p_text,
            "response": res["response"],
            "latency_sec": res["latency_sec"],
            "retrieval_curation_id": res.get("retrieval_curation_id"),
            "retrieval_principles": res.get("retrieval_principles"),
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
        "model_name": f"grounded-prototype-{curator.model_name}",
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
    print(f"PROTOTYPE REGRESSION SCORECARD")
    print("="*50)
    for dim, score in means.items():
        print(f"  - {dim.replace('_', ' ').title():<34}: {score:.2f} / 5.0")
    print("-" * 50)
    print(f"  >> OVERALL SCORE                 : {overall_mean:.2f} / 5.0")
    print(f"  >> FLAGGED FAILURE RATE          : {failure_rate}% ({failure_count}/{total})")
    print("="*50 + "\n")

    return summary

if __name__ == "__main__":
    curator = GroundedCurator("nova-fashion-opt-v3")
    
    # 1. Run Expanded Suite
    evaluate_prototype_expanded(
        curator,
        "fashion_ai/evaluation/eval_prompts_expanded.json",
        "fashion_ai/evaluation/prototype_expanded_results.json"
    )

    # 2. Run Regression Suite
    evaluate_prototype_regression(
        curator,
        "fashion_ai/evaluation/eval_prompts.json",
        "fashion_ai/evaluation/prototype_regression_results.json"
    )
