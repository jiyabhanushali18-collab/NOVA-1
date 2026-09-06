import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from vision_service import analyze_image_with_vision

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

@app.post("/api/analyze-vision")
async def analyze_vision_endpoint(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        results = analyze_image_with_vision(image_bytes)
        return {"status": "success", "data": results}
    except Exception as e:
        print(f"❌ Vision API Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))