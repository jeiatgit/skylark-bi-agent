"""
FastAPI Server Entry Point for Skylark BI Agent (Python)
Provides REST API endpoints and serves the Glassmorphism frontend interface.
"""

import time
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.agent import run_agent
from app.analytics import get_kpis, refresh_data, get_data
from app.config import (
    PORT,
    GEMINI_MODEL,
    MONDAY_API_TOKEN,
    DEALS_BOARD_ID,
    WORK_ORDERS_BOARD_ID,
)

app = FastAPI(
    title="Skylark Drones — Monday.com Business Intelligence Agent",
    description="Autonomous Business Intelligence AI Agent powered by FastAPI, pandas, and Google Gemini.",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None


@app.on_event("startup")
def startup_event():
    """Pre-load and normalize business data into memory on startup."""
    print("🚀 Initializing Skylark BI Agent Python data store (pandas)...")
    get_data()
    print("✨ Skylark BI Agent (FastAPI) initialized and ready.")


# ══════════════════════════════════════════════════════════════════════════
# REST API ROUTES
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """Conversational AI query endpoint."""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    start_time = time.time()
    try:
        result = run_agent(req.message.strip())
        duration_ms = round((time.time() - start_time) * 1000)

        return {
            "success": True,
            "reply": result["text"],
            "toolsUsed": result["toolsUsed"],
            "toolResults": result["toolResults"],
            "durationMs": duration_ms,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/kpis")
def kpis_endpoint():
    """Retrieve top-level computed KPI telemetry."""
    try:
        kpis = get_kpis()
        return {"success": True, "data": kpis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sync")
def sync_endpoint():
    """Trigger live synchronization from monday.com GraphQL API."""
    start_time = time.time()
    try:
        cache = refresh_data()
        duration_ms = round((time.time() - start_time) * 1000)
        return {
            "success": True,
            "message": "Data synchronized successfully",
            "source": cache["source"],
            "dealsCount": len(cache["deals_df"]),
            "workOrdersCount": len(cache["work_orders_df"]),
            "lastSync": cache["last_sync"],
            "durationMs": duration_ms,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/status")
def sync_status_endpoint():
    """Return data cache health and last sync timestamp."""
    data = get_data()
    return {
        "success": True,
        "source": data["source"],
        "dealsCount": len(data["deals_df"]),
        "workOrdersCount": len(data["work_orders_df"]),
        "lastSync": data["last_sync"],
    }


@app.get("/api/health")
def health_endpoint():
    """System health check endpoint."""
    data = get_data()
    return {
        "status": "healthy",
        "agent": "Skylark BI Agent (FastAPI / Python)",
        "geminiModel": GEMINI_MODEL,
        "mondayConfigured": bool(MONDAY_API_TOKEN),
        "dealsBoardConfigured": bool(DEALS_BOARD_ID),
        "workOrdersBoardConfigured": bool(WORK_ORDERS_BOARD_ID),
        "dataSource": data["source"],
        "dealsLoaded": len(data["deals_df"]),
        "workOrdersLoaded": len(data["work_orders_df"]),
        "lastSync": data["last_sync"],
    }


# ══════════════════════════════════════════════════════════════════════════
# STATIC FILE SERVING (GLASSMORPHISM FRONTEND)
# ══════════════════════════════════════════════════════════════════════════

public_dir = Path(__file__).resolve().parent.parent / "public"
app.mount("/static", StaticFiles(directory=public_dir), name="static")


@app.get("/")
def serve_index():
    return FileResponse(public_dir / "index.html")


@app.get("/{full_path:path}")
def serve_static(full_path: str):
    file_path = public_dir / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(public_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
