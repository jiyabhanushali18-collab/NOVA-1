import json
import statistics

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    results = data['results']
    n = len(results)
    print(f"\n{'='*70}\nVerifying: {filepath} ({data['model_name']}, {n} prompts)\n{'='*70}")

    dims = list(results[0]['scores'].keys())
    recalc_means = {}
    for d in dims:
        scores = [r['scores'][d] for r in results]
        m = round(sum(scores) / n, 2)
        recalc_means[d] = m
        reported = data['dimension_means'].get(d)
        diff = abs(m - (reported if reported is not None else 0))
        match = "OK" if diff < 0.015 else f"MISMATCH (rep={reported}, calc={m})"
        print(f"  {d:<30}: calc={m:.2f} | rep={reported} | {match}")

    calc_overall = round(sum(recalc_means.values()) / len(dims), 2)
    rep_overall = data.get('overall_mean_score')
    print(f"  --> OVERALL: calc={calc_overall:.2f} | rep={rep_overall}")

    # Latencies
    latencies = [r['latency_sec'] for r in results if 'latency_sec' in r]
    if latencies:
        print(f"  Latency stats: mean={statistics.mean(latencies):.2f}s, median={statistics.median(latencies):.2f}s, min={min(latencies):.2f}s, max={max(latencies):.2f}s")

    return data, recalc_means

def compare_v3_v4_prompts():
    with open('fashion_ai/evaluation/opt_v3_results.json', 'r', encoding='utf-8') as f:
        v3_reg = {r['prompt_id']: r for r in json.load(f)['results']}
    with open('fashion_ai/evaluation/opt_v4_regression_results.json', 'r', encoding='utf-8') as f:
        v4_reg = {r['prompt_id']: r for r in json.load(f)['results']}

    print(f"\n{'='*70}\nPROMPT-BY-PROMPT REGRESSION ANALYSIS: v3 vs v4 (Where did v4 change?)\n{'='*70}")
    gender_regressions = []
    coherence_regressions = []
    palette_regressions = []
    improvements = []

    for pid in sorted(v3_reg.keys()):
        s3 = v3_reg[pid]['scores']
        s4 = v4_reg[pid]['scores']
        tot3 = v3_reg[pid]['overall_prompt_score']
        tot4 = v4_reg[pid]['overall_prompt_score']
        delta = round(tot4 - tot3, 2)

        if s4['gender_compliance'] < s3['gender_compliance']:
            gender_regressions.append((pid, v3_reg[pid]['category'], s3['gender_compliance'], s4['gender_compliance'], v4_reg[pid]['diagnostics'], v4_reg[pid]['response'][:300]))
        if s4['coherence'] < s3['coherence']:
            coherence_regressions.append((pid, v3_reg[pid]['category'], s3['coherence'], s4['coherence'], v4_reg[pid]['diagnostics']))
        if s4['palette_consistency'] < s3['palette_consistency']:
            palette_regressions.append((pid, v3_reg[pid]['category'], s3['palette_consistency'], s4['palette_consistency'], v4_reg[pid]['diagnostics']))
        if delta >= 0.20:
            improvements.append((pid, v3_reg[pid]['category'], tot3, tot4, delta))

    print(f"\n1. Gender Compliance Regressions (v4 < v3): {len(gender_regressions)} prompts")
    for pid, cat, old_s, new_s, diags, resp in gender_regressions:
        print(f"   [{pid}] ({cat}): {old_s} -> {new_s} | Diags: {diags}")
        print(f"         Snippet: {resp[:200]}...")

    print(f"\n2. Coherence Regressions (v4 < v3): {len(coherence_regressions)} prompts")
    for pid, cat, old_s, new_s, diags in coherence_regressions:
        print(f"   [{pid}] ({cat}): {old_s} -> {new_s} | Diags: {diags}")

    print(f"\n3. Palette Consistency Regressions (v4 < v3): {len(palette_regressions)} prompts")
    for pid, cat, old_s, new_s, diags in palette_regressions:
        print(f"   [{pid}] ({cat}): {old_s} -> {new_s} | Diags: {diags}")

    print(f"\n4. Significant Overall Improvements (v4 - v3 >= +0.20): {len(improvements)} prompts")
    for pid, cat, old_t, new_t, d in improvements:
        print(f"   [{pid}] ({cat}): {old_t} -> {new_t} (+{d})")

if __name__ == '__main__':
    for fn in [
        'fashion_ai/evaluation/baseline_results.json',
        'fashion_ai/evaluation/opt_v3_results.json',
        'fashion_ai/evaluation/opt_v4_regression_results.json',
        'fashion_ai/evaluation/v3_expanded_results.json',
        'fashion_ai/evaluation/v4_expanded_results.json'
    ]:
        check_file(fn)

    compare_v3_v4_prompts()
