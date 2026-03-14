"""
Sahayak Backend — FastAPI Main Application
AI Co-Pilot for CSC Operators
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import os
from dotenv import load_dotenv

# Ensure backend directory is in the path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
load_dotenv()

# Import routers
from models.xgboost_model import router as predict_router
from validation.rules import router as validate_router
from rag.query import router as query_router
from autocorrect.suggest import router as autocorrect_router
from db.tracker import router as dashboard_router, init_db
from voice.voice import router as voice_router
from ocr.llama_ocr import router as ocr_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events"""
    print(f"🚀 Sahayak Backend Starting from: {__file__}")
    print("ROUTES:", [r.path for r in app.routes])
    init_db()
    print("✅ Database initialized")
    yield
    print("👋 Sahayak Backend Shutting Down...")

app = FastAPI(
    title="Sahayak — AI Co-Pilot for CSC Operators",
    description="Offline-first intelligent assistant for frontline CSC operators",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(predict_router, prefix="/api", tags=["Prediction"])
app.include_router(validate_router, prefix="/api", tags=["Validation"])
app.include_router(query_router, prefix="/api", tags=["RAG Chatbot"])
app.include_router(autocorrect_router, prefix="/api", tags=["AutoCorrect"])
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])
app.include_router(voice_router, prefix="/api", tags=["Voice"])
app.include_router(ocr_router, prefix="/api", tags=["OCR"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Sahayak AI Co-Pilot"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
