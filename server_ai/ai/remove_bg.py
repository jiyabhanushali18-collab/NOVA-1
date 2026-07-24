from rembg import remove
from PIL import Image

def remove_background(input_path, output_path):
    image = Image.open(input_path)
    result = remove(image)
    result.save(output_path)