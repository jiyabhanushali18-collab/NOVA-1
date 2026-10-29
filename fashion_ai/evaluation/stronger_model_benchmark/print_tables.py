import json
import os

with open(r'fashion_ai\evaluation\stronger_model_benchmark\benchmark_results.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print('=== 32-PROMPT REGRESSION SUITE ===')
print(f'{"Metric":<32} | {"Base 0.5B":<10} | {"Opt-v3":<10} | {"Opt-v4":<10} | {"Proto RAG":<10} | {"Cand 1.5B":<10}')
print('-'*95)
m_reg = d['suite_1_regression_32_prompts']['models']
dims = list(m_reg['baseline_0.5b']['dimension_means'].keys())
for dim in dims:
    b = m_reg['baseline_0.5b']['dimension_means'].get(dim, 0)
    v3 = m_reg['opt_v3_0.5b']['dimension_means'].get(dim, 0)
    v4 = m_reg['opt_v4_0.5b']['dimension_means'].get(dim, 0)
    pr = m_reg['prototype_rag_0.5b']['dimension_means'].get(dim, 0)
    c = m_reg['candidate_1.5b']['dimension_means'].get(dim, 0)
    print(f'{dim:<32} | {b:<10.2f} | {v3:<10.2f} | {v4:<10.2f} | {pr:<10.2f} | {c:<10.2f}')
print('-'*95)
print(f'{"OVERALL MEAN SCORE":<32} | {m_reg["baseline_0.5b"]["overall_score"]:<10.2f} | {m_reg["opt_v3_0.5b"]["overall_score"]:<10.2f} | {m_reg["opt_v4_0.5b"]["overall_score"]:<10.2f} | {m_reg["prototype_rag_0.5b"]["overall_score"]:<10.2f} | {m_reg["candidate_1.5b"]["overall_score"]:<10.2f}')
print(f'{"FAILURE RATE (%)":<32} | {m_reg["baseline_0.5b"]["failure_rate_pct"]:<10.1f} | {m_reg["opt_v3_0.5b"]["failure_rate_pct"]:<10.1f} | {m_reg["opt_v4_0.5b"]["failure_rate_pct"]:<10.1f} | {m_reg["prototype_rag_0.5b"]["failure_rate_pct"]:<10.1f} | {m_reg["candidate_1.5b"]["failure_rate_pct"]:<10.1f}')
print(f'{"MEAN LATENCY (SEC)":<32} | {m_reg["baseline_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_reg["opt_v3_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_reg["opt_v4_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_reg["prototype_rag_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_reg["candidate_1.5b"]["latency"]["mean_sec"]:<10.2f}')

print('\n=== 16-PROMPT DEEP FASHION INTELLIGENCE SUITE ===')
print(f'{"Metric":<32} | {"Opt-v3":<10} | {"Opt-v4":<10} | {"Proto RAG":<10} | {"Cand 1.5B":<10}')
print('-'*80)
m_exp = d['suite_2_expanded_intelligence_16_prompts']['models']
dims_exp = list(m_exp['opt_v3_0.5b']['dimension_means'].keys())
for dim in dims_exp:
    v3 = m_exp['opt_v3_0.5b']['dimension_means'].get(dim, 0)
    v4 = m_exp['opt_v4_0.5b']['dimension_means'].get(dim, 0)
    pr = m_exp['prototype_rag_0.5b']['dimension_means'].get(dim, 0)
    c = m_exp['candidate_1.5b']['dimension_means'].get(dim, 0)
    print(f'{dim:<32} | {v3:<10.2f} | {v4:<10.2f} | {pr:<10.2f} | {c:<10.2f}')
print('-'*80)
print(f'{"OVERALL MEAN SCORE":<32} | {m_exp["opt_v3_0.5b"]["overall_score"]:<10.2f} | {m_exp["opt_v4_0.5b"]["overall_score"]:<10.2f} | {m_exp["prototype_rag_0.5b"]["overall_score"]:<10.2f} | {m_exp["candidate_1.5b"]["overall_score"]:<10.2f}')
print(f'{"FAILURE RATE (%)":<32} | {m_exp["opt_v3_0.5b"]["failure_rate_pct"]:<10.1f} | {m_exp["opt_v4_0.5b"]["failure_rate_pct"]:<10.1f} | {m_exp["prototype_rag_0.5b"]["failure_rate_pct"]:<10.1f} | {m_exp["candidate_1.5b"]["failure_rate_pct"]:<10.1f}')
print(f'{"MEAN LATENCY (SEC)":<32} | {m_exp["opt_v3_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_exp["opt_v4_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_exp["prototype_rag_0.5b"]["latency"]["mean_sec"]:<10.2f} | {m_exp["candidate_1.5b"]["latency"]["mean_sec"]:<10.2f}')
