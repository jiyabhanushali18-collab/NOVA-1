import json

with open('fashion_ai/evaluation/baseline_results.json', 'r', encoding='utf-8') as f:
    base = json.load(f)

with open('fashion_ai/evaluation/opt_v1_results.json', 'r', encoding='utf-8') as f:
    v1 = json.load(f)

with open('fashion_ai/evaluation/opt_v2_results.json', 'r', encoding='utf-8') as f:
    v2 = json.load(f)

with open('fashion_ai/evaluation/opt_v3_results.json', 'r', encoding='utf-8') as f:
    v3 = json.load(f)

print("="*70)
print(f"{'Dimension':<30} | {'Baseline':<8} | {'Opt-v1':<8} | {'Opt-v2':<8} | {'Opt-v3':<8}")
print("="*70)

dims = list(base['dimension_means'].keys())
for d in dims:
    b_val = base['dimension_means'][d]
    v1_val = v1['dimension_means'][d]
    v2_val = v2['dimension_means'][d]
    v3_val = v3['dimension_means'][d]
    print(f"{d:<30} | {b_val:<8.2f} | {v1_val:<8.2f} | {v2_val:<8.2f} | {v3_val:<8.2f}")

print("-"*70)
print(f"{'OVERALL SCORE':<30} | {base['overall_mean_score']:<8.2f} | {v1['overall_mean_score']:<8.2f} | {v2['overall_mean_score']:<8.2f} | {v3['overall_mean_score']:<8.2f}")
print("="*70)
