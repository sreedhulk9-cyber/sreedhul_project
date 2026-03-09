from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database.models import hash_password, verify_password
from database.db import get_db_connection

router = APIRouter(prefix="/api")

class SignupRequest(BaseModel):
    driver_name: str
    username: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class StartSessionRequest(BaseModel):
    driver_id: int

class RecordFeaturesRequest(BaseModel):
    session_id: int
    blink_rate: float = 0.0
    eye_closure_duration: float = 0.0
    yawn_probability: float = 0.0
    head_pitch: float = 0.0
    head_yaw: float = 0.0
    head_roll: float = 0.0
    eye_aspect_ratio: float = 0.0
    mouth_aspect_ratio: float = 0.0
    consciousness_score: float = 0.0
    drowsiness_flag: int = 0

class EndSessionRequest(BaseModel):
    session_id: int

@router.post("/signup")
async def signup(req: SignupRequest):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM drivers WHERE username = ?", (req.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username already exists")
        
        hashed_pw = hash_password(req.password)
        cursor.execute(
            "INSERT INTO drivers (driver_name, username, password_hash) VALUES (?, ?, ?)",
            (req.driver_name, req.username, hashed_pw)
        )
        conn.commit()
    finally:
        conn.close()
        
    return {"message": "Signup successful"}

@router.post("/login")
async def login(req: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM drivers WHERE username = ?", (req.username,))
        row = cursor.fetchone()
    finally:
        conn.close()
    
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {"message": "Login successful", "driver_id": row["driver_id"]}

@router.post("/start-session")
async def start_session(req: StartSessionRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("INSERT INTO driving_sessions (driver_id) VALUES (?)", (req.driver_id,))
        session_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()
    
    return {"message": "Session started", "session_id": session_id}

@router.post("/record-driver-features")
async def record_driver_features(req: RecordFeaturesRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO driver_features (
            session_id, blink_rate, eye_closure_duration, yawn_probability,
            head_pitch, head_yaw, head_roll, eye_aspect_ratio, mouth_aspect_ratio,
            consciousness_score, drowsiness_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            req.session_id, req.blink_rate, req.eye_closure_duration, req.yawn_probability,
            req.head_pitch, req.head_yaw, req.head_roll, req.eye_aspect_ratio, req.mouth_aspect_ratio,
            req.consciousness_score, req.drowsiness_flag
        ))
        conn.commit()
    finally:
        conn.close()
        
    return {"message": "Features recorded"}

@router.post("/end-session")
async def end_session(req: EndSessionRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("UPDATE driving_sessions SET end_time = CURRENT_TIMESTAMP WHERE session_id = ?", (req.session_id,))
        conn.commit()
    finally:
        conn.close()
    
    return {"message": "Session ended"}
