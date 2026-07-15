import sys
from rembg import remove
from PIL import Image

input_path = sys.argv[1]

output_path = input_path.replace("uploads","output")

image = Image.open(input_path)

output = remove(image)

output.save(output_path)

print(output_path)