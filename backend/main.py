"""
CareGiver Hub — FastAPI Backend
Serves patient data from MongoDB and proxies AI requests to the CaregiverAgent.

Run:
    uvicorn main:app --reload --port 8000
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from services.mongodb import seed_mock_data
from routes import patients, medications, events, notes, personal_notes, history, ai

# CORS: Allow frontend origins from environment or use defaults
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed_mock_data()
        print("[OK] MongoDB connected and seeded.")
    except Exception as e:
        print(f"[WARNING] MongoDB unavailable ({e.__class__.__name__}): {e}")
        print("  Backend will run without database - connect MongoDB to enable persistence.")
    yield


app = FastAPI(
    title="CareGiver Hub API",
    description="Backend for the CareGiver app — unified health management powered by Fetch.ai ASI-1 Mini.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router, prefix="/api")
app.include_router(medications.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(personal_notes.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}

@app.get("/", tags=["health"])
async def root():
    return {
        "service": "CareGiver Hub API",
        "status": "ok",
        "docs": "/docs",
    }
