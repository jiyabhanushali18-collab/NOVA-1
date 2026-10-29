# Forensic Audit of NOVA Evaluation Methodology

**Author**: Senior ML Evaluation Specialist & Fashion AI Researcher  
**Date**: October 26, 2026  
**Target Repository**: `D:\NOVA-1`  
**Evaluators Audited**:
- `fashion_ai/evaluation/evaluate_model.py` (Regression Suite Evaluator)
- `fashion_ai/evaluation/evaluate_fashion_intelligence.py` (Deep Intelligence Evaluator)
- Raw telemetry datasets: `baseline_results.json`, `opt_v3_results.json`, `opt_v4_regression_results.json`, `v3_expanded_results.json`, `v4_expanded_results.json`, `prototype_regression_results.json`

---

## 1. Executive Summary

Our forensic audit reveals that while the evaluation engine is **100% deterministic, transparent, and reproducible** (containing no fabricated numbers or non-deterministic LLM-as-a-judge bias), its scoring architecture suffers from **systemic structural biases that elevate the baseline score floor and reward superficial syntax over deep sartorial harmony**:

1. **High Default Score Floor (Inflation to ~3.8 – 4.0)**: Several dimensions (`palette_consistency`, `trend_reliability`, `practicality`) initialize at 4.0, 4.5, or 5.0 and only deduct points when negative triggers occur. Prompts without explicit palette constraints automatically receive an unearned 4.0 for color consistency.
2. **Keyword Density Bias (Length & Vocabulary Rewarded)**: In `fit_and_silhouette` and `fabric_texture_compatibility`, scores are calculated by counting matched fashion terms (e.g. matching $\ge 4$ silhouette terms yields 5.0). A model can assemble words ("oversized tailored wide-leg relaxed") without sartorial coherence and receive top marks.
3. **Formatting Favoritism (Numbered List Bias)**: `diversity_and_structure` awards 4.5 simply for formatting responses as numbered lists (`^\s*\d+[\.\)]\s+`). This rewards the rigid habit inherited from the `neuralwork/fashion-style-instruct` training data (which always outputs `Outfit 1:`, `Outfit 2:`).
4. **Lack of Compositional Harmony Checks**: The evaluator checks if a top, bottom, and shoes exist, but does not verify whether the specific garments harmonize (e.g. pairing a heavy winter cable-knit with lightweight running shorts and flip-flops receives a pass on coherence as long as no nonsense words are present).

---

## 2. Forensic Analysis by Dimension

| Dimension | Scoring Mechanism | Vulnerability / Bias Identified | Impact on Reported Scores |
| :--- | :--- | :--- | :--- |
| **Coherence & Wearability** | Starts at 4.0; deducts for nonsense regex (`skin height`), misplaced anatomy, or multiple tops without headers. Checks top + bottom + shoe presence. | **Permissive on Clash**: Does not check whether the garments physically or contextually clash if all 3 anchor categories exist. | Scores cluster in 3.6 – 3.9 range even when styling is questionable. |
| **Palette Consistency** | Matches expected colors against dictionary. Defaults to 4.0 if no palette specified in prompt metadata. | **Free Pass on Unconstrained Prompts**: On 8 prompts with no requested palette, models receive a free 4.0 without testing color harmony. | Inflates overall palette average to ~3.59. |
| **Footwear & Accessories** | Starts at 3.5; +0.5 for shoes, +0.5 for accessories; deducts for silver/gold mix or skate heels. | **Presence over Compatibility**: Recommending an evening satin clutch with a streetwear skate outfit receives 4.5 because items exist. | Artificially high scores (4.14 – 4.47). |
| **Fit & Silhouette** | Counts occurrences of 17 silhouette terms (`wide-leg`, `boxy`, `tailored`, etc.). $\ge 4 \rightarrow 5.0$, $\ge 2 \rightarrow 4.0$. | **Pure Keyword Counting**: Does not verify proportion balance (e.g., tight-top/loose-bottom vs shapeless bulk). | Models mentioning multiple cut terms easily score 4.2 – 4.5. |
| **Fabric Compatibility** | Counts occurrences of 22 fabric terms (`wool`, `silk`, `denim`, etc.). $\ge 3 \rightarrow 4.5$. | **Texture Density Bias**: Mentions of materials are rewarded without checking seasonal weight compatibility. | Fails to detect incompatible weights (e.g. chiffon with shearling). |
| **Diversity & Structure** | Awards 4.5 for numbered lists or headers; deducts for rambling >12 lines. | **Format Bias**: Rewards the model's bad habit of listing multiple disjointed outfits when only one was requested. | Scores (3.3 – 3.7) reflect list syntax rather than true conceptual diversity. |
| **Trend Reliability** | For trend queries, requires transparency keywords. For non-trend queries, defaults to 5.0. | **Passive High Score**: Only 4 out of 32 prompts test trends; the remaining 28 receive automatic 5.0s. | Artificially inflates the composite score (4.81 – 4.95). |
| **Gender Compliance** | Regex filters for cross-gender garment intrusions (e.g., skirts/gowns in men's prompts). | **Highly Accurate & Reliable**: Genuinely catches cross-gender hallucinations; one of the most trustworthy metrics in the suite. | Correctly flagged v4's regression on `p14` (5.0 $\rightarrow$ 1.5). |

---

## 3. Telemetry & Calculation Verification

We cross-checked all raw JSON result files using independent recalculation scripts:
- **Baseline (`baseline_results.json`)**: 32 prompts; calculated overall mean = **4.09**, reported = **4.09**.
- **Candidate 3 (`opt_v3_results.json`)**: 32 prompts; calculated overall mean = **4.14**, reported = **4.14**.
- **Candidate 4 (`opt_v4_regression_results.json`)**: 32 prompts; calculated overall mean = **4.16**, reported = **4.16**.
- **Prototype Regression (`prototype_regression_results.json`)**: 32 prompts; calculated overall mean = **3.91**, reported = **3.91**.
- **Conclusion**: There are **no mathematical discrepancies or fabricated scores** in the repository. All reported numbers reflect the true arithmetic mean of the evaluator's output.

---

## 4. Latency & Timeout Truth

- The earlier informal claim that average latency dropped to 8.2s was based on a quick glance at median runtimes for simple prompts (~5–8s).
- **True Measured Metrics**:
  - `nova-fashion` (Baseline): Mean = **13.68s**, Median = **11.99s**
  - `nova-fashion-opt-v3`: Mean = **11.78s**, Median = **10.75s**
  - `nova-fashion-opt-v4`: Mean = **11.51s**, Median = **8.88s**
  - `grounded-prototype`: Mean = **9.81s** (on successful runs), but suffered **4 severe timeouts (>75s)**, failing completely on complex prompts due to prompt-cache bloat on CPU.

---

## 5. Architectural Recommendations for Next-Generation Evaluation

To prevent models from gaming the evaluation suite:
1. **Remove the Default 4.0/5.0 Floor**: For unconstrained palettes, evaluate internal color harmony (checking whether the model chose colors from compatible color wheels or established palettes) rather than awarding a free 4.0.
2. **Penalize Volume Imbalance**: Introduce checks for shapeless extremes (e.g. oversized top + oversized bottom + oversized outerwear without waist definition or proportion anchors).
3. **Strict Single-Outfit Enforcement**: If a user asks for an outfit, penalize responses that output "Outfit 1:" and "Outfit 2:". A stylist provides a curated, definitive choice.
4. **Preservation**: This audit document serves as the historical record. All improved evaluation rubrics must be maintained in separate scripts without overwriting historical regression data.
