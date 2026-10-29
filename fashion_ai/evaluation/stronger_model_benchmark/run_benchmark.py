#!/usr/bin/env python3
"""
Comprehensive Benchmarking and Evaluation Script for NOVA Stronger Model Candidate.
Runs identical evaluation protocol across both suites:
1. eval_prompts.json (32 regression prompts)
2. eval_prompts_expanded.json (16 deep fashion intelligence prompts)
Saves results and telemetry into fashion_ai/evaluation/stronger_model_benchmark/.
"""

import sys
import os
import json
import time

# Add fashion_ai/evaluation to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from evaluate_fashion_intelligence import run_fashion_eval, query_ollama

BENCHMARK_DIR = os.path.abspath(os.path.dirname(__file__))
PROMPTS_EXPANDED = os.path.abspath(os.path.join(BENCHMARK_DIR, "..", "eval_prompts_expanded.json"))
PROMPTS_REGRESSION = os.path.abspath(os.path.join(BENCHMARK_DIR, "..", "eval_prompts.json"))

MODEL_NAME = "nova-fashion-1.5b-benchmark"

def run_candidate_benchmark():
    print(f"=== STARTING BENCHMARK FOR CANDIDATE MODEL: {MODEL_NAME} ===")
    
    # 1. Run Expanded Intelligence Suite (16 Prompts)
    out_exp = os.path.join(BENCHMARK_DIR, "candidate_1.5b_expanded_results.json")
    print(f"\n[RUN 1/2] Evaluating on 16 Deep Intelligence Prompts...")
    summary_exp = run_fashion_eval(
        model_name=MODEL_NAME,
        prompts_path=PROMPTS_EXPANDED,
        output_path=out_exp
    )
    
    # 2. Run Regression Suite (32 Prompts)
    out_reg = os.path.join(BENCHMARK_DIR, "candidate_1.5b_regression_results.json")
    print(f"\n[RUN 2/2] Evaluating on 32 Regression Prompts...")
    summary_reg = run_fashion_eval(
        model_name=MODEL_NAME,
        prompts_path=PROMPTS_REGRESSION,
        output_path=out_reg
    )
    
    print("\n[OK] Candidate evaluation runs complete.")

if __name__ == "__main__":
    run_candidate_benchmark()
