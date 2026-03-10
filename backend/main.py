from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from logic_engine import DrowsinessDetector
from driver_alertness import DriverAlertnessScorer
from database.models import init_db
from database.db import get_db_connection
from api_router import router as api_router
from prediction_sync import start_background_predictions

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DrowsyBackend")

app = FastAPI()

@app.on_event("startup")
def startup_event():
    # Initialize Database
    init_db()
    
    # Fully activate and bind prediction engine continuously per session
    app.state.scheduler = start_background_predictions()

@app.on_event("shutdown")
def shutdown_event():
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)

# Initialize Detector Logic
detector = DrowsinessDetector()
alertness_scorer = DriverAlertnessScorer()

@app.get("/")
async def root():
    return {"status": "active", "system": "Drowsiness Detection Backend"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            
            # Process through logic engine
            result = detector.process_frame(data)

            # Update alertness score
            try:
                timestamp = float(data.get("timestamp", 0.0))
                ear = float(data.get("ear", 1.0))
                pitch = float(data.get("pitch", 0.0))
                yaw = float(data.get("yaw", 0.0))
                score = alertness_scorer.update_from_signals(
                    ear=ear,
                    pitch=pitch,
                    yaw=yaw,
                    timestamp=timestamp,
                )
                result["alertness_score"] = round(score, 1)
            except Exception as e:
                logger.error(f"Error updating alertness score: {e}")
                result.setdefault("alertness_score", alertness_scorer.get_score())

            await websocket.send_text(json.dumps(result))
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
        try:
            await websocket.close()
        except:
            pass
# --- Debug Endpoints (Read-Only) ---

@app.get("/debug/drivers")
async def debug_drivers():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT driver_id, driver_name, username, created_at FROM drivers")
        drivers = cursor.fetchall()
        return drivers
    finally:
        conn.close()

@app.get("/debug/features")
async def debug_features():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT 
                session_id, timestamp, blink_rate, eye_closure_duration, yawn_probability,
                head_pitch, head_yaw, head_roll, eye_aspect_ratio, mouth_aspect_ratio,
                consciousness_score, drowsiness_flag
            FROM driver_features
            ORDER BY timestamp DESC
            LIMIT 100
        ''')
        features = cursor.fetchall()
        return features
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
