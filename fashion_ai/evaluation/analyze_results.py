import json
import sys

def analyze(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        d = json.load(f)

    print(f"File: {filepath}")
    print(f"Model: {d['model_name']}")
    print(f"Overall Mean Score: {d['overall_mean_score']} / 5.0")
    print("\n--- Dimension Breakdown ---")
    for dim, score in d['dimension_means'].items():
        print(f"  {dim:<28}: {score:.2f}")

    print("\n--- Weakest Prompts (< 3.90) ---")
    low = [x for x in d['results'] if x['overall_prompt_score'] < 3.90]
    for x in sorted(low, key=lambda item: item['overall_prompt_score']):
        print("-" * 50)
        print(f"ID: {x['prompt_id']} | Cat: {x['category']} | Score: {x['overall_prompt_score']}")
        print(f"Prompt: {x['prompt']}")
        print(f"Scores: {x['scores']}")
        print(f"Diagnostics: {x['diagnostics']}")
        print(f"Response Preview:\n{x['response'][:450]}...\n")

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'fashion_ai/evaluation/baseline_results.json'
    analyze(path)
