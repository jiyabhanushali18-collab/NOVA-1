#!/usr/bin/env python3
"""
NOVA Grounded Fashion Intelligence Prototype.
Selects targeted, relevant sartorial reference curations and enduring principles
from fashion_ai/knowledge/ and injects them dynamically as grounding context
into the local Ollama model.
"""

import sys
import os
import json
import time
import re
import urllib.request

KNOWLEDGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "knowledge")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")

class GroundedCurator:
    def __init__(self, model_name: str = "nova-fashion-opt-v3"):
        self.model_name = model_name
        self.principles = self._load_json(os.path.join(KNOWLEDGE_DIR, "enduring_principles.json")).get("principles", [])
        self.curations = self._load_json(os.path.join(KNOWLEDGE_DIR, "reference_curations.json"))
        self.trend_gov = self._load_json(os.path.join(KNOWLEDGE_DIR, "trend_governance.json")).get("rules", [])

    def _load_json(self, path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load {path}: {e}")
            return []

    def analyze_prompt(self, prompt: str) -> dict:
        p_lower = prompt.lower()

        # 1. Target Wearer Detection
        target_wearer = "universal"
        if re.search(r"\b(man|men|male|guy|groom)\b", p_lower):
            if re.search(r"\b(skirt|kilt|dress)\b", p_lower):
                target_wearer = "non_conventional"
            else:
                target_wearer = "men"
        elif re.search(r"\b(woman|women|female|lady|bride)\b", p_lower):
            if re.search(r"\b(menswear|menswear-tailored|un-feminized)\b", p_lower):
                target_wearer = "non_conventional"
            else:
                target_wearer = "women"
        elif re.search(r"\b(androgynous|unisex|gender[- ]neutral|gender[- ]free)\b", p_lower):
            target_wearer = "androgynous"

        # 2. Aesthetic Detection
        aesthetic = "general"
        if re.search(r"\b(clean[- ]girl|clean girl|pinterest)\b", p_lower):
            aesthetic = "clean_girl"
        elif re.search(r"\b(minimalist|minimalism|capsule|monochrome|architecture)\b", p_lower):
            aesthetic = "minimalist"
        elif re.search(r"\b(streetwear|skate|y2k|gorpcore|cargo|oversized)\b", p_lower):
            aesthetic = "streetwear"
        elif re.search(r"\b(wedding|semi-formal|coastal wedding)\b", p_lower):
            aesthetic = "semi_formal"
        elif re.search(r"\b(black[- ]tie|gala|tuxedo|dinner jacket)\b", p_lower):
            aesthetic = "tropical_black_tie"
        elif re.search(r"\b(quiet luxury|old money|cashmere|alpine|shearling)\b", p_lower):
            aesthetic = "quiet_luxury"
        elif re.search(r"\b(monsoon|torrential|rain|waterproof)\b", p_lower):
            aesthetic = "functional_monsoon"
        elif re.search(r"\b(interview|tech startup|agency|smart casual)\b", p_lower):
            aesthetic = "smart_casual"
        elif re.search(r"\b(avant[- ]garde|kilt|skirt|creative)\b", p_lower):
            aesthetic = "modern_creative"

        # 3. Climate / Weather Detection
        climate = "temperate"
        if re.search(r"\b(sub-zero|snow|-8c|-10c|winter|freezing)\b", p_lower):
            climate = "sub_zero"
        elif re.search(r"\b(32c|34c|30c|humid|heatwave|tropical|summer)\b", p_lower):
            climate = "hot_humid"
        elif re.search(r"\b(rain|monsoon|downpour)\b", p_lower):
            climate = "rain"

        # 4. Conflict & Trend Detection
        is_trend = bool(re.search(r"\b(trend|trending|2026|runway|tiktok|viral)\b", p_lower))
        is_conflict = bool(re.search(r"\b(sweatpants.*black[- ]tie|black[- ]tie.*sweatpants|sub-zero.*shorts|shorts.*sub-zero)\b", p_lower))
        
        # 5. Negative Constraints
        neg_matches = re.findall(r"\bno\s+([a-zA-Z\s-]+?)(?:,|\.|\band\b|$)", p_lower)
        neg_constraints = [m.strip() for m in neg_matches if m.strip()]

        return {
            "target_wearer": target_wearer,
            "aesthetic": aesthetic,
            "climate": climate,
            "is_trend": is_trend,
            "is_conflict": is_conflict,
            "neg_constraints": neg_constraints
        }

    def retrieve_references(self, prompt: str) -> dict:
        analysis = self.analyze_prompt(prompt)
        tw = analysis["target_wearer"]
        aes = analysis["aesthetic"]
        clim = analysis["climate"]

        # Score curations
        scored_curations = []
        for c in self.curations:
            score = 0.0
            # Gender match / filter
            c_tw = c.get("target_wearer", "universal")
            if tw == "non_conventional":
                if c_tw == "non_conventional":
                    score += 5.0
            elif tw in ["men", "women"]:
                if c_tw == tw:
                    score += 4.0
                elif c_tw == "universal":
                    score += 1.0
                else:
                    score -= 5.0  # Penalize cross-gender reference
            elif tw == "androgynous":
                if c_tw in ["androgynous", "universal"]:
                    score += 4.0

            # Aesthetic match
            c_aes = c.get("aesthetic", "")
            if aes == c_aes:
                score += 5.0
            elif aes in c_aes or c_aes in aes:
                score += 2.5

            # Climate / Occasion keyword match
            c_clim = c.get("climate", "").lower()
            if clim == "sub_zero" and ("snow" in c_clim or "sub-zero" in c_clim or "-8c" in c_clim):
                score += 4.0
            elif clim == "hot_humid" and ("hot" in c_clim or "34c" in c_clim or "32c" in c_clim or "summer" in c_clim or "coastal" in c_clim):
                score += 4.0
            elif clim == "rain" and ("rain" in c_clim or "monsoon" in c_clim):
                score += 4.0

            scored_curations.append((score, c))

        scored_curations.sort(key=lambda x: x[0], reverse=True)
        top_curation = scored_curations[0][1] if scored_curations and scored_curations[0][0] > 0 else None

        # Select matching enduring principles
        matched_principles = []
        if aes in ["clean_girl", "minimalist", "smart_casual"] or "broad" in prompt.lower():
            matched_principles.append(self._get_principle("PRIN-01"))  # Rule of thirds
            matched_principles.append(self._get_principle("PRIN-02"))  # Volume balance
        elif aes == "streetwear":
            matched_principles.append(self._get_principle("PRIN-02"))  # Volume balance
            matched_principles.append(self._get_principle("PRIN-07"))  # Footwear to hemline
        elif "texture" in prompt.lower() or "satin" in prompt.lower() or "knit" in prompt.lower() or "monochrome" in prompt.lower():
            matched_principles.append(self._get_principle("PRIN-04"))  # Texture contrast
            matched_principles.append(self._get_principle("PRIN-05"))  # 60-30-10 color
        elif "hardware" in prompt.lower() or "brass" in prompt.lower() or "belt" in prompt.lower():
            matched_principles.append(self._get_principle("PRIN-08"))  # Hardware finish
        else:
            matched_principles.append(self._get_principle("PRIN-01"))
            matched_principles.append(self._get_principle("PRIN-05"))

        return {
            "analysis": analysis,
            "curation": top_curation,
            "principles": [p for p in matched_principles if p is not None]
        }

    def _get_principle(self, pid: str):
        for p in self.principles:
            if p["id"] == pid:
                return p
        return None

    def build_grounded_prompt(self, user_prompt: str) -> dict:
        retrieval = self.retrieve_references(user_prompt)
        curation = retrieval["curation"]
        principles = retrieval["principles"]
        analysis = retrieval["analysis"]

        grounding_lines = ["[SARTORIAL GROUNDING REFERENCE]"]
        if curation:
            grounding_lines.append(f"- Master Aesthetic: {curation['aesthetic'].replace('_', ' ').title()}")
            grounding_lines.append(f"- Recommended Archetype: Top: {curation['garments'].get('top', '')} | Bottom: {curation['garments'].get('bottom', '')} | Shoes: {curation['footwear_and_accessories'].get('footwear', '')}")
            grounding_lines.append(f"- Why It Works: {curation['why_it_works']}")
            grounding_lines.append(f"- Common Mistakes to Avoid: {'; '.join(curation.get('common_mistakes_to_avoid', [])[:2])}")
        
        for p in principles:
            grounding_lines.append(f"- Applied Principle: {p['name']}: {p['application']}")

        if analysis["is_trend"]:
            grounding_lines.append("- Trend Policy: Transparently acknowledge knowledge cutoff; do not fabricate fake 2026 runway citations or sales data.")
        if analysis["neg_constraints"]:
            grounding_lines.append(f"- Strict Negative Constraints: Do NOT mention or use: {', '.join(analysis['neg_constraints'])}.")
        if analysis["is_conflict"]:
            grounding_lines.append("- Conflict Rule: Address the dress code or weather contradiction directly before offering an elegant compromise.")

        grounding_block = "\n".join(grounding_lines)

        system_instruction = """You are NOVA, an expert digital fashion curator and styling oracle.
Follow the provided [SARTORIAL GROUNDING REFERENCE] closely.
Always curate a complete, wearable outfit: Top, Bottom, Footwear (mandatory), and Accessories.
Strictly adhere to the requested gender category and negative constraints."""

        full_prompt = f"{grounding_block}\n\nUser Request: {user_prompt}"

        return {
            "full_prompt": full_prompt,
            "system_instruction": system_instruction,
            "retrieval": retrieval
        }

    def curate(self, user_prompt: str, options: dict = None) -> dict:
        bundle = self.build_grounded_prompt(user_prompt)
        payload = {
            "model": self.model_name,
            "prompt": bundle["full_prompt"],
            "system": bundle["system_instruction"],
            "stream": False
        }
        if options:
            payload["options"] = options
        else:
            payload["options"] = {
                "temperature": 0.35,
                "top_p": 0.85,
                "top_k": 30,
                "repeat_penalty": 1.15
            }

        start_time = time.time()
        req = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=75) as resp:
                elapsed = time.time() - start_time
                res_json = json.loads(resp.read().decode("utf-8"))
                return {
                    "response": res_json.get("response", ""),
                    "latency_sec": round(elapsed, 3),
                    "eval_count": res_json.get("eval_count", 0),
                    "retrieval_curation_id": bundle["retrieval"]["curation"]["id"] if bundle["retrieval"]["curation"] else "none",
                    "retrieval_principles": [p["id"] for p in bundle["retrieval"]["principles"]],
                    "error": None
                }
        except Exception as e:
            elapsed = time.time() - start_time
            return {
                "response": "",
                "latency_sec": round(elapsed, 3),
                "eval_count": 0,
                "retrieval_curation_id": "error",
                "retrieval_principles": [],
                "error": str(e)
            }

if __name__ == "__main__":
    curator = GroundedCurator()
    sample_queries = [
        "Style a woman for a weekend farmers market in clean-girl aesthetic.",
        "Recommend a summer outdoor wedding guest outfit for a man in semi-formal coastal style.",
        "Style a modern Gen Z streetwear outfit for a young man with NO hoodies and NO black.",
        "A formal black-tie optional summer gala in sweltering 34C humid heat for a man.",
        "I'm a man; recommend a pleated skirt outfit that looks balanced and modern."
    ]

    print("===================================================================")
    print("DEMONSTRATING DYNAMIC RETRIEVAL DIVERSITY ACROSS USER REQUESTS")
    print("===================================================================\n")

    for q in sample_queries:
        r = curator.retrieve_references(q)
        cid = r["curation"]["id"] if r["curation"] else "NONE"
        caes = r["curation"]["aesthetic"] if r["curation"] else "N/A"
        ctw = r["curation"]["target_wearer"] if r["curation"] else "N/A"
        pids = [p["id"] for p in r["principles"]]
        print(f"QUERY: '{q}'")
        print(f"  --> RETRIEVED CURATION: [{cid}] ({caes}, wearer={ctw})")
        print(f"  --> RETRIEVED PRINCIPLES: {pids}\n")
