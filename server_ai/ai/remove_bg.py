from pathlib import Path
from PIL import Image, ImageOps

_session = None


def _remove(image):
    # Keep one ONNX model in memory. Creating a new rembg session for every
    # scan is the main reason phone uploads feel slow.
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session("u2net_human_seg")
    return remove(image, session=_session)


def remove_background(input_path, output_path):
    image = Image.open(input_path)
    image = ImageOps.exif_transpose(image).convert("RGBA")
    result = _remove(image)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, format="PNG")


def extract_garment(input_path, output_path, category=""):
    """Remove the scene, then retain the part of the person where the selected garment lives.

    A normal background-removal model returns the complete person. For wardrobe scans
    that is still noisy (face, trousers, shoes), so this makes a garment-focused crop.
    The user-selected category is deliberately used as the reliable body-region hint.
    """
    source = Image.open(input_path)
    # Ensure correct orientation based on camera EXIF tags
    source = ImageOps.exif_transpose(source).convert("RGBA")
    # A 4K camera image adds latency without improving closet-card quality.
    source.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    subject = _remove(source)
    alpha = subject.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        subject.save(output_path, format="PNG")
        return

    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    if width <= 0 or height <= 0:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        subject.save(output_path, format="PNG")
        return

    aspect = height / max(1, width)
    cat = (category or "").lower()
    bottom_categories = ("jeans", "trousers", "shorts", "leggings", "palazzo")
    full_categories = ("dress", "saree", "co-ord", "ethnic")

    # If the segmented object is already garment-sized (not a full human body standing),
    # or no category is specified, retain full bounds to avoid clipping sleeves, collars, or hems.
    if aspect < 1.35 or not cat:
        region = (left, top, right, bottom)
    elif any(value in cat for value in full_categories):
        region = (left, top + int(height * 0.08), right, bottom)
    elif any(value in cat for value in bottom_categories):
        # Bottoms begin around waist level. Keeping full horizontal width preserves leg silhouettes.
        bottom_start = 0.50 if any(value in cat for value in ("jeans", "trousers", "leggings", "palazzo")) else 0.46
        bottom_end = 0.85 if "shorts" in cat else 1.0
        region = (left, top + int(height * bottom_start), right, top + int(height * bottom_end))
    else:
        # Tops: retain full width to avoid clipping sleeves/cuffs, and vertical window from neck/collar down to hips
        region = (left, top + int(height * 0.12), right, top + int(height * 0.62))

    garment = subject.crop(region)
    garment_alpha = garment.getchannel("A")
    garment_bounds = garment_alpha.getbbox()
    if garment_bounds:
        padding = 16
        gl, gt, gr, gb = garment_bounds
        garment = garment.crop((
            max(0, gl - padding),
            max(0, gt - padding),
            min(garment.width, gr + padding),
            min(garment.height, gb + padding)
        ))

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    garment.save(output_path, format="PNG")
