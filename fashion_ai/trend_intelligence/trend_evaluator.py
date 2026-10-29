"""
NOVA Gen Z & Trend Intelligence Evaluator
Standalone scoring module for evaluating fashion curations across 7 dimensions:
1. factual_trend_grounding
2. aesthetic_differentiation
3. regional_climate_practicality
4. outfit_coherence_wearability
5. constraint_compliance
6. gender_integrity
7. affordability_materiality
"""

import sys
import os
import re
from typing import Dict, Any, List, Tuple

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fashion_ai.trend_intelligence.run_trend_evaluation import score_trend_curation, check_outfit_constraints

class TrendEvaluator:
    def __init__(self):
        pass

    def evaluate(self, curation: Dict[str, Any], prompt_meta: Dict[str, Any]) -> Tuple[Dict[str, float], float, List[str]]:
        return score_trend_curation(curation, prompt_meta)

if __name__ == "__main__":
    print("[OK] TrendEvaluator initialized successfully.")
