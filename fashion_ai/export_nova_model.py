"""
NOVA Fashion Model Exporter
---------------------------
This script merges our fine-tuned Qwen2.5-0.5B LoRA adapter (trained in Colab and saved
in Google Drive at 'NOVA-fashion-model') with the base Qwen2.5-0.5B-Instruct model,
and prepares it for Ollama or local inference.

Prerequisites:
  pip install torch transformers peft

Usage:
  python fashion_ai/export_nova_model.py --lora-path path/to/NOVA-fashion-model --output-dir ./nova-fashion-merged
"""

import os
import sys
import argparse

def merge_and_export(lora_path: str, output_dir: str, base_model_id: str = "Qwen/Qwen2.5-0.5B-Instruct"):
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
    except ImportError:
        print("Error: Missing required packages. Please install via: pip install torch transformers peft")
        sys.exit(1)

    if not os.path.exists(lora_path):
        print(f"Error: LoRA adapter path does not exist: {lora_path}")
        print("Please download the 'NOVA-fashion-model' folder from Google Drive to this location first.")
        sys.exit(1)

    print(f"1. Loading base model: {base_model_id}...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_id, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        trust_remote_code=True
    )

    print(f"2. Applying LoRA adapter from: {lora_path}...")
    model = PeftModel.from_pretrained(base_model, lora_path)

    print("3. Merging weights (merge_and_unload)...")
    merged_model = model.merge_and_unload()

    print(f"4. Saving merged standalone model to: {output_dir}...")
    os.makedirs(output_dir, exist_ok=True)
    merged_model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    print("\n✓ Merged model successfully created at:", output_dir)
    print("\nNext steps to run in Ollama:")
    print("1. Convert to GGUF using llama.cpp:")
    print(f"   python llama.cpp/convert_hf_to_gguf.py {output_dir} --outfile ./nova-fashion-0.5b.gguf --outtype q8_0")
    print("2. Create Ollama model:")
    print("   ollama create nova-fashion -f ./fashion_ai/Modelfile")
    print("3. Verify model runs:")
    print("   ollama run nova-fashion \"Curate a casual streetwear look for a summer day.\"")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge NOVA LoRA adapter into base Qwen2.5-0.5B model")
    parser.add_argument("--lora-path", default="NOVA-fashion-model", help="Path to downloaded LoRA adapter directory")
    parser.add_argument("--output-dir", default="./nova-fashion-merged", help="Output directory for merged weights")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-0.5B-Instruct", help="Base model identifier")
    args = parser.parse_args()

    merge_and_export(args.lora_path, args.output_dir, args.base_model)
