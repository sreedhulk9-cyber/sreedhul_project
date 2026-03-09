from .db import get_db_connection
import bcrypt

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS drivers (
        driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS driving_sessions (
        session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS driver_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        blink_rate REAL,
        eye_closure_duration REAL,
        yawn_probability REAL,
        head_pitch REAL,
        head_yaw REAL,
        head_roll REAL,
        eye_aspect_ratio REAL,
        mouth_aspect_ratio REAL,
        consciousness_score REAL,
        drowsiness_flag INTEGER,
        FOREIGN KEY (session_id) REFERENCES driving_sessions(session_id)
    )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
