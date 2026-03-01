from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from .logic_engine import DrowsinessDetector
from .driver_alertness import DriverAlertnessScorer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DrowsyBackend")

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            # Receive data from frontend
            # Expected schema: { "ear": float, "pitch": float, "yaw": float, "timestamp": float }
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            
            # Process through logic engine (detection logic unchanged)
            result = detector.process_frame(data)

            # Update continuous driver alertness score (read-only for UI)
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
                # Fall back to the last known score if available
                result.setdefault("alertness_score", alertness_scorer.get_score())

            # Send result back to frontend
            await websocket.send_text(json.dumps(result))
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
        try:
            await websocket.close()
        except:
            pass
