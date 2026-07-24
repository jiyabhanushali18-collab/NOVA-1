from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server_ai.remove_bg import remove_background

app = FastAPI(
    title="NOVA AI Server",
    version="1.0.0"
)

# Allow React App
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "NOVA AI Server is Running 🚀"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    output_path = Path("output") / f"{Path(file.filename).stem}_no_bg.png"

    remove_background(file_path, output_path)   

    return {
        "success": True,
        "filename": file.filename,
        "path": str(file_path)
    }    