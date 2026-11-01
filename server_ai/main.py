import os
import sys
import uuid
import base64
from pathlib import Path
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
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

app = FastAPI(title="NOVA AI Vision & Garment Service")

# Allow production frontend domain, Render backend origin, and local development
allowed_origins = [
    "https://nova.nova-fashion.workers.dev",
    "https://nova-1-1.onrender.com",
    "https://nova-1-7ec7.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000"
]

# Configure CORS so both Cloudflare frontend and Render backend can communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits Cloudflare preview domains and native apps
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "AI Vision Server is running",
        "service": "NOVA AI Garment Processor",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "vision_available": analyze_image_with_vision is not None,
        "bg_removal_available": (extract_garment is not None or remove_background is not None)
    }

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

import gc

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def cleanup_old_files(directory: Path, max_files: int = 25):
    """Prune old files to avoid exhausting ephemeral disk on Render/Cloud hosts."""
    try:
        files = sorted(directory.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        for old_file in files[max_files:]:
            if old_file.is_file():
                try:
                    old_file.unlink()
                except Exception:
                    pass
    except Exception:
        pass

# Mount output static files if directory exists
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

@app.post("/upload")
async def upload_image(request: Request, file: UploadFile = File(...), category: str = Form("")):
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

    # Determine public URL dynamically using request base URL or configured PUBLIC_AI_URL
    public_base = os.getenv("PUBLIC_AI_URL", str(request.base_url)).rstrip("/")
    output_url = f"{public_base}/output/{output_path.name}"

    cleanup_old_files(UPLOAD_DIR, max_files=20)
    cleanup_old_files(OUTPUT_DIR, max_files=20)
    gc.collect()

    return {
        "success": True,
        "filename": input_filename,
        "path": str(file_path),
        "processed_image": data_url,
        "image_url": output_url,
        "scan_note": "Garment-only transparent crop generated. Review details before saving."
    }
