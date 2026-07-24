def detect_garment(input_path, output_path):
    image = Image.open(input_path).convert("RGB")

    return image