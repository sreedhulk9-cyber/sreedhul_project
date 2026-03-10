import sqlite3
import os
import random
import time
from datetime import datetime, timedelta
import string

def insert_test_data():
    db_path = "backend/data.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    random_user = ''.join(random.choices(string.ascii_lowercase, k=8))
    # Create dummy driver
    cursor.execute("INSERT INTO drivers (driver_name, username, password_hash) VALUES ('Test Driver', ?, 'dummyhash')", (random_user,))
    driver_id = cursor.lastrowid

    # Create active session (no end_time)
    cursor.execute("INSERT INTO driving_sessions (driver_id) VALUES (?)", (driver_id,))
    session_id = cursor.lastrowid

    # Insert fake driver features over the last 5 minutes
    
    for i in range(300):
        # 1 record per second for last 5 mins
        blink_rate = random.uniform(20.0, 30.0) # slightly high
        eye_closure = random.uniform(0.1, 0.4)
        yawn_prob = random.uniform(0.0, 0.1)
        head_pitch = random.uniform(-15.0, -5.0) # head nodding
        head_yaw = random.uniform(-5.0, 5.0)
        head_roll = random.uniform(-2.0, 2.0)
        consciousness = random.uniform(50.0, 70.0)
        
        cursor.execute('''
            INSERT INTO driver_features (
                session_id, timestamp, blink_rate, eye_closure_duration, yawn_probability,
                head_pitch, head_yaw, head_roll, eye_aspect_ratio, mouth_aspect_ratio,
                consciousness_score, drowsiness_flag
            ) VALUES (?, datetime('now', ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            session_id, 
            f'-{i} seconds', 
            blink_rate, eye_closure, yawn_prob,
            head_pitch, head_yaw, head_roll, 0.2, 0.0,
            consciousness, 0
        ))

    conn.commit()
    conn.close()
    print(f"Test data inserted successfully. User: {random_user}, Session ID: {session_id}")

if __name__ == '__main__':
    insert_test_data()
