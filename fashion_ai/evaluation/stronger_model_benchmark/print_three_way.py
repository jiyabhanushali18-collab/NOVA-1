import json

with open(r'fashion_ai\evaluation\stronger_model_benchmark\structured_output_results.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

cfg_a = d['configurations_summary']['config_a_opt_v4_0.5b']
cfg_b = d['configurations_summary']['config_b_1.5b_unstructured']
cfg_c = d['configurations_summary']['config_c_1.5b_structured_prototype']

print(f"{'Dimension':<34} | {'Config A (0.5B v4)':<18} | {'Config B (1.5B Unstr)':<20} | {'Config C (1.5B Struct)':<20}")
print('-'*95)
dims = list(cfg_a['dimension_means'].keys())
for dim in dims:
    da = cfg_a['dimension_means'].get(dim, 0)
    db = cfg_b['dimension_means'].get(dim, 0)
    dc = cfg_c['dimension_means'].get(dim, 0)
    print(f"{dim:<34} | {da:<18.2f} | {db:<20.2f} | {dc:<20.2f}")
print('-'*95)
print(f"{'OVERALL MEAN SCORE':<34} | {cfg_a['overall_mean_score']:<18.2f} | {cfg_b['overall_mean_score']:<20.2f} | {cfg_c['overall_mean_score']:<20.2f}")
print(f"{'GARMENT SLOT ACCURACY (%)':<34} | {cfg_a['slot_accuracy_pct']:<18.1f} | {cfg_b['slot_accuracy_pct']:<20.1f} | {cfg_c['slot_accuracy_pct']:<20.1f}")
print(f"{'FLAGGED FAILURE RATE (%)':<34} | {cfg_a['failure_rate_pct']:<18.1f} | {cfg_b['failure_rate_pct']:<20.1f} | {cfg_c['failure_rate_pct']:<20.1f}")
print(f"{'MEAN LATENCY (SEC)':<34} | {cfg_a['mean_latency_sec']:<18.2f} | {cfg_b['mean_latency_sec']:<20.2f} | {cfg_c['mean_latency_sec']:<20.2f}")
print(f"{'MEDIAN LATENCY (SEC)':<34} | {cfg_a['median_latency_sec']:<18.2f} | {cfg_b['median_latency_sec']:<20.2f} | {cfg_c['median_latency_sec']:<20.2f}")
print(f"{'MIN / MAX LATENCY (SEC)':<34} | {str(cfg_a['min_latency_sec']) + ' / ' + str(cfg_a['max_latency_sec']):<18} | {str(cfg_b['min_latency_sec']) + ' / ' + str(cfg_b['max_latency_sec']):<20} | {str(cfg_c['min_latency_sec']) + ' / ' + str(cfg_c['max_latency_sec']):<20}")
print(f"{'VALID STRUCTURED OUTPUT (%)':<34} | {'N/A':<18} | {'N/A':<20} | {cfg_c['valid_structured_output_rate_pct']:<20.1f}")
print(f"{'RETRY RATE (%)':<34} | {'N/A':<18} | {'N/A':<20} | {cfg_c['retry_rate_pct']:<20.1f}")
print(f"{'MEAN INITIAL LATENCY (SEC)':<34} | {'N/A':<18} | {'N/A':<20} | {cfg_c['mean_initial_latency_sec']:<20.2f}")
print(f"{'MEAN RETRY LATENCY (SEC)':<34} | {'N/A':<18} | {'N/A':<20} | {cfg_c['mean_retry_latency_sec']:<20.2f}")
