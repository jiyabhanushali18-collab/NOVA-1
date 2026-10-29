import json

def load_res(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# 1. Regression Suite
base_reg = load_res('fashion_ai/evaluation/baseline_results.json')
v3_reg = load_res('fashion_ai/evaluation/opt_v3_results.json')
v4_reg = load_res('fashion_ai/evaluation/opt_v4_regression_results.json')
proto_reg = load_res('fashion_ai/evaluation/prototype_regression_results.json')

# 2. Expanded Suite
v3_exp = load_res('fashion_ai/evaluation/v3_expanded_results.json')
v4_exp = load_res('fashion_ai/evaluation/v4_expanded_results.json')
proto_exp = load_res('fashion_ai/evaluation/prototype_expanded_results.json')

print("="*85)
print("PART 1: 32-PROMPT REGRESSION SUITE COMPARISON (ALL 4 CONFIGURATIONS)")
print("="*85)
print(f"{'Dimension':<32} | {'Baseline':<8} | {'Opt-v3':<8} | {'Opt-v4':<8} | {'Prototype (RAG)':<15}")
print("-"*85)

for d in base_reg['dimension_means'].keys():
    b = base_reg['dimension_means'][d]
    v3 = v3_reg['dimension_means'][d]
    v4 = v4_reg['dimension_means'][d]
    pr = proto_reg['dimension_means'].get(d, 0.0)
    print(f"{d:<32} | {b:<8.2f} | {v3:<8.2f} | {v4:<8.2f} | {pr:<15.2f}")

print("-"*85)
print(f"{'OVERALL COMPOSITE SCORE':<32} | {base_reg['overall_mean_score']:<8.2f} | {v3_reg['overall_mean_score']:<8.2f} | {v4_reg['overall_mean_score']:<8.2f} | {proto_reg['overall_mean_score']:<15.2f}")
print(f"{'FAILURE RATE (%)':<32} | {base_reg['failure_rate_pct']:<8.1f} | {v3_reg['failure_rate_pct']:<8.1f} | {v4_reg['failure_rate_pct']:<8.1f} | {proto_reg['failure_rate_pct']:<15.1f}")
print("="*85)

print("\n" + "="*85)
print("PART 2: 16-PROMPT DEEP FASHION INTELLIGENCE SUITE COMPARISON")
print("="*85)
print(f"{'Dimension':<34} | {'Opt-v3':<10} | {'Opt-v4':<10} | {'Prototype (RAG)':<15}")
print("-"*85)

for d in v3_exp['dimension_means'].keys():
    v3 = v3_exp['dimension_means'][d]
    v4 = v4_exp['dimension_means'][d]
    pr = proto_exp['dimension_means'].get(d, 0.0)
    print(f"{d:<34} | {v3:<10.2f} | {v4:<10.2f} | {pr:<15.2f}")

print("-"*85)
print(f"{'OVERALL FASHION QUALITY SCORE':<34} | {v3_exp['overall_mean_score']:<10.2f} | {v4_exp['overall_mean_score']:<10.2f} | {proto_exp['overall_mean_score']:<15.2f}")
print(f"{'FAILURE RATE (%)':<34} | {v3_exp['failure_rate_pct']:<10.1f} | {v4_exp['failure_rate_pct']:<10.1f} | {proto_exp['failure_rate_pct']:<15.1f}")
print("="*85)
