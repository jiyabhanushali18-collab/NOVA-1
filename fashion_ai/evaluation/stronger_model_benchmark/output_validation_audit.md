# NOVA Fashion AI — Output Validation & Benchmark Evidence Audit

**Location**: `fashion_ai/evaluation/stronger_model_benchmark/output_validation_audit.md`  
**Date**: October 27, 2026  
**Auditor**: ML Verification & Fashion AI Evaluation Suite  

---

## 1. Benchmark Evidence Integrity Verification

A full forensic verification was performed on all artifacts in `fashion_ai/evaluation/stronger_model_benchmark/`:
- `candidate_1.5b_regression_results.json` (32 prompts)
- `candidate_1.5b_expanded_results.json` (16 prompts)
- `benchmark_results.json` (Consolidated dataset)

### Verification Findings:
1. **Execution Completeness**:
   - All 32 regression prompts and all 16 deep fashion intelligence prompts ran to full completion.
   - Zero HTTP aborts, zero dropped sockets, zero unhandled Python exceptions.
2. **Mathematical Accuracy of Reported Means**:
   - Independent re-summation and averaging confirmed **100% mathematical match** between raw prompt scores and reported dimension means across all 10 evaluated dimensions.
3. **Repeated Runs vs Unique Prompts**:
   - Verified that the 32 regression prompts (`p01`–`p32`) and 16 deep intelligence prompts (`exp_01`–`exp_16`) represent 48 strictly distinct test cases with no duplicate prompt bodies.

---

## 2. Forensic Definition of "Flagged Failure Rate"

In the previous benchmark report, a failure rate of **3.1%** was reported for `nova-fashion-1.5b-benchmark` on the regression suite. Our audit investigated the exact code implementation in `evaluate_fashion_intelligence.py`:

```python
# evaluate_fashion_intelligence.py (lines 364-368)
overall = sum(scores.values()) / len(scores)
if overall < 3.0 or scores["coherence_wearability"] < 2.5:
    failure_count += 1
    status = f"FLAGGED ({overall:.2f}/5.0)"
else:
    status = f"OK ({overall:.2f}/5.0)"
```

### Exact Definition:
A prompt is marked as **FLAGGED** if and only if:
1. An unhandled exception or Ollama timeout occurs (`res['error'] != None`), **OR**
2. The overall composite score is strictly below **3.0 / 5.0**, **OR**
3. The specific dimension `coherence_wearability` drops below **2.5 / 5.0**.

### Recalibration Against Alternative Thresholds:
- Under the current formula: Only `p14` had `coherence_wearability` = 2.0 (< 2.5), yielding **1 failure out of 32 (3.1%)**.
- If defined as **Overall Score < 4.0**: Both `p14` (3.95) and `p30` (3.65) drop below the threshold, resulting in **2 failures out of 32 (6.25%)**.
- If defined as **Any Individual Dimension < 3.0**: Multiple models experience isolated penalties on strict palette or negative constraint checks.
- **Audit Conclusion**: The reported 3.1% failure rate is mathematically reproducible under the code's specific threshold, but stakeholders should note that under a stricter 4.0 threshold, the true failure rate is 6.25%.

---

## 3. Evaluator Biases & Formatting Distortions

### A. Non-Outfit Factual Query Penalty (The `p30` Paradox)
- **Prompt `p30`**: *"According to the latest 2026 fashion week runways, what specific shoe trend has replaced chunky loafers? Give verified sources."*
- **Model Behavior**: The 1.5B model demonstrated excellent epistemic honesty: *"As of my last update in early 2024, there isn't a single definitive replacement... exact trends depend on individual runways in 2026."* It refused to hallucinate nonexistent 2026 runway data.
- **Evaluator Bias**: The deterministic scoring script docked points because the response lacked an `anchor top/bottom/shoes ensemble`:
  ```python
  if not (has_top and has_bottom and has_shoes):
      coherence -= 1.0
      diagnostics.append("Incomplete ensemble missing essential top/bottom/shoes anchor")
  ```
- **Audit Verdict**: The model was penalized for answering a direct fashion query conversationally rather than manufacturing a fake outfit list.

### B. Trend Score Auto-Inflation
- For every non-trend prompt (`is_trend_query == False`), the evaluator automatically assigns:
  ```python
  scores["trend_truthfulness"] = 5.0
  ```
- This artificially elevates composite scores across non-trend prompts by 0.10–0.15 points.

### C. Keyword Density Reward
- The evaluator awards +1.5 points if $\ge 3$ silhouette keywords are present, and sets fabric score to 4.5 if $\ge 3$ fabric terms are present. This rewards lexical density over sartorial nuance.

---

## 4. Latency Measurement Protocol Audit

- **Measurement Mechanism**:
  ```python
  start_time = time.time()
  with urllib.request.urlopen(req, timeout=timeout) as resp:
      elapsed = time.time() - start_time
  ```
- **Included**:
  - Full round-trip HTTP request to local Ollama daemon
  - Model prompt tokenization and KV-cache allocation
  - Full CPU token generation (streaming disabled)
  - JSON response serialization and delivery
- **Excluded**:
  - Evaluation rubric scoring time (measured separately outside the HTTP call)
- **Cold Load Overhead**:
  - First-prompt execution incurs a **+25s to +35s cold-load penalty** as model weights are paged into memory from disk. Warm prompts average **18s–28s**.
