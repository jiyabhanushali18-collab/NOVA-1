import os
from pathlib import Path
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from vision_service import analyze_image_with_vision
except ImportError:
    analyze_image_with_vision = None

try:
    from ai.remove_bg import remove_background, extract_garment
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
        print(f"❌ Vision API Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Mount output static files if directory exists
app.mount("/output", StaticFiles(directory="output"), name="output")

@app.post("/upload")
async def upload_image(file: UploadFile = File(...), category: str = Form("")):
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    output_path = OUTPUT_DIR / f"{Path(file.filename).stem}_no_bg.png"

    if extract_garment:
        extract_garment(file_path, output_path, category)
    elif remove_background:
        remove_background(file_path, output_path)

    return {
        "success": True,
        "filename": file.filename,
        "path": str(file_path),
        "processed_image": f"http://127.0.0.1:8000/output/{output_path.name}",
        "scan_note": "Garment-only crop generated. Review details before saving."
    }
