#!/usr/bin/env python3
"""
Integration Test Runner for NOVA Isolated Structured 1.5B API
Tests the 10 representative requests against POST http://127.0.0.1:3001/api/curate-structured.
Saves comprehensive telemetry to integration_test_results.json.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

ENDPOINT = os.environ.get("TEST_ENDPOINT", "http://127.0.0.1:3001/api/curate-structured")
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "integration_test_results.json")

TEST_CASES = [
    {
        "id": "req_01",
        "category": "clean_girl",
        "prompt": "Curate a clean-girl aesthetic summer daytime outfit in crisp white and soft beige. Include light layering and gold minimalist jewelry.",
        "expectations": {
            "target_gender": "women",
            "required_palette": ["white", "beige"],
            "must_avoid": [],
            "key_attributes": ["gold jewelry", "light layering"]
        }
    },
    {
        "id": "req_02",
        "category": "minimalist",
        "prompt": "Design a modern minimalist everyday outfit in neutral tones with fluid tailoring and relaxed proportions.",
        "expectations": {
            "target_gender": "universal",
            "required_palette": ["neutral", "grey", "black", "cream", "white"],
            "must_avoid": [],
            "key_attributes": ["fluid tailoring", "relaxed proportions"]
        }
    },
    {
        "id": "req_03",
        "category": "mens_smart_casual",
        "prompt": "Recommend a men's smart casual outfit for an evening rooftop networking event in spring. NO t-shirts and NO distressed denim.",
        "expectations": {
            "target_gender": "men",
            "must_avoid": ["t-shirt", "denim"],
            "key_attributes": ["smart casual", "rooftop networking"]
        }
    },
    {
        "id": "req_04",
        "category": "womens_occasion",
        "prompt": "Curate an elevated evening cocktail party outfit for a woman in an emerald green and gold palette with refined fabric textures.",
        "expectations": {
            "target_gender": "women",
            "required_palette": ["emerald green", "gold"],
            "must_avoid": [],
            "key_attributes": ["cocktail party", "refined fabric"]
        }
    },
    {
        "id": "req_05",
        "category": "gender_neutral",
        "prompt": "Style a gender-neutral, androgynous everyday outfit built around boxy tailoring, straight-leg trousers, and derbies in slate blue and charcoal.",
        "expectations": {
            "target_gender": "neutral",
            "required_palette": ["slate blue", "charcoal"],
            "must_avoid": [],
            "key_attributes": ["boxy tailoring", "derbies", "straight-leg trousers"]
        }
    },
    {
        "id": "req_06",
        "category": "non_conventional_masculine",
        "prompt": "I am a man and I want to wear a black pleated midi skirt for a contemporary gallery opening. Style me in an elevated, architecturally balanced outfit without feminizing the look.",
        "expectations": {
            "target_gender": "men",
            "allows_non_conventional": True,
            "mandatory_items": ["pleated skirt"],
            "must_avoid": ["blouse", "heels"],
            "key_attributes": ["architectural balance", "dignified styling"]
        }
    },
    {
        "id": "req_07",
        "category": "strict_exclusions",
        "prompt": "Curate an elevated casual Friday outfit for a creative director in rich earth tones (olive, cream, chocolate brown). STRICT EXCLUSION: NO black clothing, NO hoodies, and NO sneakers anywhere in the outfit.",
        "expectations": {
            "target_gender": "universal",
            "must_avoid": ["black", "hoodie", "sneaker"],
            "required_palette": ["olive", "cream", "chocolate brown"]
        }
    },
    {
        "id": "req_08",
        "category": "climate_dress_code_tension",
        "prompt": "Recommend a formal black-tie optional summer gala outfit for a man in a sweltering 34°C humid tropical climate. How can he meet black-tie formality without heat exhaustion?",
        "expectations": {
            "target_gender": "men",
            "climate": "hot_humid",
            "formality": "formal",
            "must_avoid": ["wool overcoat", "heavy coat", "shorts", "t-shirt"]
        }
    },
    {
        "id": "req_09",
        "category": "strict_budget",
        "prompt": "Design a cohesive elevated casual capsule outfit for under $150 total budget using accessible, natural fabric textures (cotton, canvas). Specify realistic item types.",
        "expectations": {
            "max_budget": 150,
            "key_attributes": ["accessible", "natural fabrics"]
        }
    },
    {
        "id": "req_10",
        "category": "trend_honesty",
        "prompt": "According to the latest 2026 fashion week runways, what specific shoe trend has replaced chunky loafers? Cite verified sources or explain knowledge limits.",
        "expectations": {
            "is_trend_query": True,
            "must_avoid": ["fake citations", "fabricated 2026 data"],
            "key_attributes": ["honest knowledge boundary"]
        }
    }
]

def run_tests():
    print("=" * 65)
    print("STARTING NOVA ISOLATED API INTEGRATION TEST (10 REQUESTS)")
    print(f"Target Endpoint: {ENDPOINT}")
    print("=" * 65)

    results = []
    success_count = 0
    rejected_count = 0
    error_count = 0

    for idx, tc in enumerate(TEST_CASES):
        req_id = tc["id"]
        category = tc["category"]
        prompt = tc["prompt"]

        print(f"\n[{idx+1}/10] Testing {req_id} ({category})...", flush=True)

        payload = {"message": prompt}
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            ENDPOINT,
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )

        start_time = time.time()
        http_status = 0
        response_body = {}
        client_error = None

        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                http_status = resp.status
                response_body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            http_status = e.code
            try:
                response_body = json.loads(e.read().decode("utf-8"))
            except Exception:
                response_body = {"raw_error": str(e)}
        except Exception as e:
            client_error = str(e)
            http_status = 500
            response_body = {"client_exception": str(e)}

        duration_sec = round(time.time() - start_time, 2)
        status = response_body.get("status", "error")
        metadata = response_body.get("metadata", {})
        data = response_body.get("data")
        retries = metadata.get("retry_count", 0)
        safe_to_display = metadata.get("safe_to_display", False)

        if status == "success":
            success_count += 1
            print(f"  -> SUCCESS ({http_status}) in {duration_sec}s | Retries: {retries} | Safe: {safe_to_display}")
        elif status == "rejected":
            rejected_count += 1
            err_details = response_body.get("error", {}).get("details", [])
            print(f"  -> REJECTED ({http_status}) in {duration_sec}s | Retries: {retries} | Details: {err_details}")
        else:
            error_count += 1
            print(f"  -> ERROR ({http_status}) in {duration_sec}s | Client Error: {client_error}")

        # Qualitative inspection notes
        unresolved_issue = None
        if status == "rejected":
            unresolved_issue = f"Hard constraint violation after retry: {response_body.get('error', {}).get('details')}"
        elif status == "success":
            # Check for qualitative sartorial anomalies
            if category == "mens_smart_casual":
                top_item = str(data.get("top", {}).get("item", "")).lower()
                if "t-shirt" in top_item or "tee" in top_item:
                    unresolved_issue = "Model used t-shirt in smart casual"
            elif category == "climate_dress_code_tension":
                top_item = str(data.get("top", {}).get("item", "")).lower()
                if "blouse" in top_item:
                    unresolved_issue = "Female garment 'blouse' in men's formal gala top"

        results.append({
            "test_id": req_id,
            "category": category,
            "original_prompt": prompt,
            "http_status": http_status,
            "status": status,
            "total_latency_sec": duration_sec,
            "retry_count": retries,
            "safe_to_display": safe_to_display,
            "parsed_structured_output": data,
            "error_response": response_body.get("error"),
            "unresolved_fashion_quality_issue": unresolved_issue
        })

    # Consolidated summary
    latencies = [r["total_latency_sec"] for r in results]
    summary = {
        "metadata": {
            "test_suite": "10 Representative Integration Tests",
            "model": "nova-fashion-1.5b-benchmark",
            "endpoint": ENDPOINT,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        },
        "stats": {
            "total_requests": len(results),
            "success_count": success_count,
            "rejected_count": rejected_count,
            "error_count": error_count,
            "success_rate_pct": round((success_count / len(results)) * 100, 1),
            "rejection_rate_pct": round((rejected_count / len(results)) * 100, 1),
            "mean_latency_sec": round(sum(latencies) / len(latencies), 2),
            "median_latency_sec": round(sorted(latencies)[len(latencies)//2], 2),
            "min_latency_sec": round(min(latencies), 2),
            "max_latency_sec": round(max(latencies), 2)
        },
        "results": results
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 65)
    print("INTEGRATION TEST SUMMARY")
    print("=" * 65)
    print(f"Total Requests:     {len(results)}")
    print(f"Successful Outfits: {success_count} ({summary['stats']['success_rate_pct']}%)")
    print(f"Rejected Outfits:   {rejected_count} ({summary['stats']['rejection_rate_pct']}%)")
    print(f"Server Errors:      {error_count}")
    print(f"Mean Latency:       {summary['stats']['mean_latency_sec']}s")
    print(f"Median Latency:     {summary['stats']['median_latency_sec']}s")
    print("=" * 65)
    print(f"\n[OK] Results saved to: {RESULTS_PATH}")

if __name__ == "__main__":
    run_tests()
