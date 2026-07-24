from PIL import Image
from pathlib import Path
def extract_texture(input_path, output_path):
    image = Image.open(input_path).convert("RGB")
    width, height = image.size

    left = width * 0.30
    top = height * 0.30
    right = width * 0.70
    bottom = height * 0.65

    texture = image.crop((left, top, right, bottom))
    texture.save(output_path)

    return output_path