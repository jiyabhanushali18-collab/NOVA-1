import os
import sys
import uuid
import base64
from pathlib import Path
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from vision_service import analyze_image_with_vision
except ImportError:
    try:
        from server_ai.vision_service import analyze_image_with_vision
    except ImportError:
        analyze_image_with_vision = None

try:
    from ai.remove_bg import remove_background, extract_garment
except ImportError:
    try:
        from server_ai.ai.remove_bg import remove_background, extract_garment
    except ImportError:
        remove_background = None
        extract_garment = None

app = FastAPI()

# Enable CORS so React frontend can communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "AI Vision Server is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/api/analyze-vision")
async def analyze_vision_endpoint(file: UploadFile = File(...)):
    try:
        if not analyze_image_with_vision:
            raise HTTPException(status_code=500, detail="Vision service is not available")
        image_bytes = await file.read()
        results = analyze_image_with_vision(image_bytes)
        return {"status": "success", "data": results}
    except Exception as e:
        print(f"[Vision API] Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Mount output static files if directory exists
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

@app.post("/upload")
async def upload_image(file: UploadFile = File(...), category: str = Form("")):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    clean_stem = "".join(c for c in Path(file.filename).stem if c.isalnum() or c in ("-", "_")) or "garment"
    unique_suffix = uuid.uuid4().hex[:8]
    input_filename = f"{clean_stem}_{unique_suffix}{Path(file.filename).suffix or '.jpg'}"
    output_filename = f"{clean_stem}_{unique_suffix}_no_bg.png"

    file_path = UPLOAD_DIR / input_filename
    output_path = OUTPUT_DIR / output_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    try:
        if extract_garment:
            extract_garment(file_path, output_path, category)
        elif remove_background:
            remove_background(file_path, output_path)
        else:
            raise HTTPException(status_code=500, detail="Background removal service is not available")
    except Exception as e:
        print(f"[remove_bg] Processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(e)}")

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise HTTPException(status_code=500, detail="Background removal failed to produce an output image")

    with open(output_path, "rb") as f:
        b64_png = base64.b64encode(f.read()).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_png}"

    return {
        "success": True,
        "filename": input_filename,
        "path": str(file_path),
        "processed_image": data_url,
        "image_url": f"http://127.0.0.1:8000/output/{output_path.name}",
        "scan_note": "Garment-only transparent crop generated. Review details before saving."
    }
