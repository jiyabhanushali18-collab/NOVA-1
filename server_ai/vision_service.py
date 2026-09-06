import os
from google.cloud import vision
from dotenv import load_dotenv

load_dotenv()

# Set explicit relative path to your service account key file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(CURRENT_DIR, "gcp-key.json")

if os.path.exists(KEY_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_PATH

def analyze_image_with_vision(image_bytes: bytes):
    """
    Sends raw image bytes to Google Cloud Vision API to detect
    garment objects, labels, and dominant colors.
    """
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)

    # Call Vision API features
    response = client.annotate_image({
        'image': image,
        'features': [
            {'type_': vision.Feature.Type.OBJECT_LOCALIZATION},
            {'type_': vision.Feature.Type.LABEL_DETECTION},
            {'type_': vision.Feature.Type.IMAGE_PROPERTIES},
        ]
    })

    # Extract detected objects
    detected_objects = [obj.name for obj in response.localized_object_annotations]

    # Extract primary labels
    labels = [label.description for label in response.label_annotations]

    # Extract dominant RGB color
    colors = response.image_properties_annotation.dominant_colors.colors
    primary_color = None
    if colors:
        c = colors[0].color
        primary_color = {"r": c.red, "g": c.green, "b": c.blue}

    return {
        "objects": detected_objects,
        "labels": labels,
        "primary_color": primary_color,
        "category": detected_objects[0] if detected_objects else "Top Wear"
    }