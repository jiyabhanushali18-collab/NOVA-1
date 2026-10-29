import json
import sys

with open('fashion_ai/trend_intelligence/trend_eval_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== SUMMARY METRICS ===")
s1 = data['summary']['condition_1_before_no_retrieval']
s2 = data['summary']['condition_2_after_with_trend_grounding']
print(f"{'Metric':<35} | {'Before':<10} | {'After':<10} | {'Delta':<8}")
print("-" * 70)
for k, v in s1['dimension_means'].items():
    v2 = s2['dimension_means'].get(k, 0.0)
    delta = v2 - v
    print(f"{k:<35} | {v:<10.2f} | {v2:<10.2f} | {delta:+.2f}")

print("-" * 70)
print(f"{'OVERALL SCORE':<35} | {s1['overall_mean_score']:<10.2f} | {s2['overall_mean_score']:<10.2f} | {s2['overall_mean_score'] - s1['overall_mean_score']:+.2f}")
print(f"{'FAILURE RATE (%)':<35} | {s1['failure_rate_pct']:<10.1f} | {s2['failure_rate_pct']:<10.1f} | {s2['failure_rate_pct'] - s1['failure_rate_pct']:+.1f}%")


lats_b = [p['duration_sec'] for p in data['results_before']]
lats_a = [p['duration_sec'] for p in data['results_after']]
print(f"\nLatency Before: mean={sum(lats_b)/len(lats_b):.2f}s, min={min(lats_b):.2f}s, max={max(lats_b):.2f}s")
clean_lats_a = [x for x in lats_a if x < 500]
print(f"Latency After (Raw): mean={sum(lats_a)/len(lats_a):.2f}s")
print(f"Latency After (Excluding OS sleep anomalies > 500s): mean={sum(clean_lats_a)/len(clean_lats_a):.2f}s, min={min(clean_lats_a):.2f}s, max={max(clean_lats_a):.2f}s (n={len(clean_lats_a)})")

flagged_after = [p for p in data['results_after'] if p['overall_score'] < 3.5 or len(p.get('diagnostics', [])) > 2]
print(f"\n=== FLAGGED FAILURES IN CONDITION 2 (COUNT: {len(flagged_after)}) ===")
for p in flagged_after:
    diags = p.get('diagnostics', [])
    print(f"Prompt ID: {p['prompt_id']}")
    print(f"Category: {p.get('category')}")
    print(f"Diagnostics: {diags}")
    print(f"Overall Score: {p.get('overall_score')}")
    print("-" * 40)


print("\n=== SELECTED COMPARISONS (BEFORE vs AFTER) ===")
test_ids = ['genz_01', 'genz_02', 'genz_08', 'genz_09', 'genz_11', 'genz_14', 'genz_17', 'genz_25']
b_map = {p['prompt_id']: p for p in data['results_before']}
a_map = {p['prompt_id']: p for p in data['results_after']}

for tid in test_ids:
    pb = b_map.get(tid)
    pa = a_map.get(tid)
    print(f"\n==================== PROMPT: {tid} ====================")
    print(f"USER PROMPT: {pb['prompt']}")
    print(f"\n--- BEFORE (Score: {pb['overall_score']:.2f}) ---")
    d_b = pb.get('data') or {}
    print(f"Top: {d_b.get('top', {}).get('item')} | Color: {d_b.get('top', {}).get('color')}")
    print(f"Bottom: {d_b.get('bottom', {}).get('item')} | Color: {d_b.get('bottom', {}).get('color')}")
    print(f"Footwear: {d_b.get('footwear', {}).get('item')} | Color: {d_b.get('footwear', {}).get('color')}")
    print(f"Palette: {d_b.get('palette')}")
    print(f"Diagnostics: {pb.get('diagnostics')}")
    print(f"\n--- AFTER (Score: {pa['overall_score']:.2f}, Trends matched: {pa.get('diagnostics', [])}) ---")
    d_a = pa.get('data') or {}
    print(f"Top: {d_a.get('top', {}).get('item')} | Color: {d_a.get('top', {}).get('color')}")
    print(f"Bottom: {d_a.get('bottom', {}).get('item')} | Color: {d_a.get('bottom', {}).get('color')}")
    print(f"Footwear: {d_a.get('footwear', {}).get('item')} | Color: {d_a.get('footwear', {}).get('color')}")
    print(f"Palette: {d_a.get('palette')}")
    print(f"Diagnostics: {pa.get('diagnostics')}")


