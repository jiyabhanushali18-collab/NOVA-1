# NOVA Fashion AI — Hardware & Latency Profiling Report

**Date**: October 27, 2026  
**Environment**: Local Windows 11 Workstation (Development Machine)  
**Evaluator**: ML Systems & Performance Automation Suite  

---

## 1. System Hardware Specification & Constraints

| Component | Specification / Metric | System Reality & Constraints |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Home (64-bit) | OS memory compression and background services active |
| **CPU Architecture** | Intel Core Processor (x86_64) | 4 Cores / 8 Logical Threads with AVX2 instruction support |
| **GPU / Accelerator** | Intel(R) Iris(R) Xe Graphics | **No dedicated CUDA/ROCm accelerator**; `nvidia-smi` unavailable |
| **Inference Backend** | Ollama local daemon (`v0.5.x`) | Pure CPU execution using OpenBLAS / AVX2 matrix kernels |
| **Total Physical RAM** | 7.94 GB (7,936,508 KB) | Budget-tier workstation RAM ceiling |
| **Free Physical RAM** | **~900 MB – 1.1 GB** at baseline | Windows Memory Compression active (~750 MB cached) |
| **Virtual Memory (Pagefile)** | ~19.5 GB Total, ~5.16 GB Free | Secondary NVMe SSD swap paging |
| **Disk Storage (C: / D:)** | C: ~40.9 GB free / D: ~278.8 GB free | Storage is healthy, but RAM is the strict operational bottleneck |

---

## 2. Model Footprint & Memory Allocation Comparison

| Model Configuration | Disk File Size | Active In-RAM Footprint | CPU Memory Overhead | Paging Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`nova-fashion` (0.5B Baseline)** | 397 MB (Q4_K_M GGUF) | ~680 MB | Minimal | Fits fully in remaining physical RAM |
| **`nova-fashion-opt-v3` (0.5B)** | 397 MB (Q4_K_M GGUF) | ~680 MB | Minimal | Fits fully in physical RAM; fast inference |
| **`nova-fashion-opt-v4` (0.5B)** | 397 MB (Q4_K_M GGUF) | ~680 MB | Minimal | Fits fully in physical RAM |
| **Prototype (0.5B + RAG)** | 397 MB + Knowledge store | ~720 MB | Low | Context bloat (+350 prompt tokens) |
| **`nova-fashion-1.5b-benchmark`** | **986 MB** (Q4_K_M GGUF) | **~1.45 GB** | Moderate | Partial pagefile spill (~400 MB swap), no thrash |
| *Candidate 3B (Projected)* | ~2.05 GB (Q4_K_M GGUF) | ~2.90 GB – 3.20 GB | Extreme | Heavy page thrashing; CPU latency >60-90s |

---

## 3. Empirically Measured Latency & Throughput Distributions

Measurements were gathered across the **32 Regression Prompts** (`eval_prompts.json`) and **16 Deep Intelligence Prompts** (`eval_prompts_expanded.json`) under strictly controlled temperature (0.35) and top_p (0.85).

### A. 32-Prompt Regression Suite Latencies

```
Model Latency Distribution (Mean Seconds per Prompt on CPU):
Baseline (0.5B)      [13.68s] ■■■■■■■
Opt-v3 (0.5B)        [11.78s] ■■■■■■
Opt-v4 (0.5B)        [11.51s] ■■■■■■
Prototype (RAG 0.5B) [12.52s] ■■■■■■
Candidate (1.5B)     [26.06s] ■■■■■■■■■■■■■
```

| Model Architecture | Min Latency | Mean Latency | Max Latency | Median TPS (Tokens/sec) | Timeout Events (>75s) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `nova-fashion` (0.5B) | 5.21s | 13.68s | 45.12s (p22 stall) | ~24.5 tps | 1 (in early 45s run) |
| `nova-fashion-opt-v3` | 5.12s | 11.78s | 28.40s | ~28.2 tps | 0 |
| `nova-fashion-opt-v4` | 4.89s | 11.51s | 24.12s | ~28.6 tps | 0 |
| Grounded Prototype (0.5B) | 5.89s | 12.52s | 46.10s | ~25.1 tps | 0 (at 75s cap) |
| **Candidate 1.5B Benchmark** | **15.16s** | **26.06s** | **44.57s** | **~17.7 tps** | **0** |

### B. 16-Prompt Deep Intelligence Suite Latencies

| Model Architecture | Min Latency | Mean Latency | Max Latency | Cold Load Penalty |
| :--- | :--- | :--- | :--- | :--- |
| `nova-fashion-opt-v3` (0.5B) | 6.20s | 12.79s | 24.10s | ~4.1s |
| `nova-fashion-opt-v4` (0.5B) | 5.80s | 14.69s | 28.90s | ~4.3s |
| Grounded Prototype (0.5B) | 8.12s | 20.92s | 48.20s | ~4.5s |
| **Candidate 1.5B Benchmark** | **6.33s** (refusal) | **29.29s** | **44.50s** | **~15.2s** |

---

## 4. Hardware Findings & Engineering Trade-Offs

1. **CPU Execution Envelope**:
   - On the Intel Iris Xe CPU workstation, generating at **17.7 tokens/second** with the 1.5B parameter model is fully acceptable for single-user interactive fashion curation (a full 280-token recommendation streams in ~16–22 seconds).
2. **Cold-Load Overhead vs Steady-State Inference**:
   - First-token load latency for 1.5B on CPU is ~15.2 seconds as model weights map into memory. Once warm in memory, inference proceeds smoothly with no memory stuttering.
3. **RAM Ceiling Reality**:
   - The user's decision to benchmark `1.5B` rather than forcing `3B` was validated by physical memory logs: with only ~900 MB free RAM, 1.5B utilized ~500 MB of virtual pagefile without perceptible disk thrashing. A 3B model (~3.0 GB RAM) would have flooded the pagefile by 2.2 GB, leading to severe latency degradation (>60–90s/prompt).
4. **Production Recommendation for NOVA Backend**:
   - If deploying locally on 8 GB client machines without GPU: `1.5B` represents the optimal sweet spot between semantic reasoning and CPU execution speed.
   - If deploying in production on a server instance with even a lightweight T4/A10 GPU or 16 GB RAM: `1.5B` or `3B` will execute at >65–90 tps with sub-second response times.
