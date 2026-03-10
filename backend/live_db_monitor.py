import sqlite3
import time

DB_PATH = "database/data.db"

while True:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n--- Latest Driver Features ---")

    cursor.execute("""
        SELECT session_id, blink_rate, eye_closure_duration,
               yawn_probability, consciousness_score
        FROM driver_features
        ORDER BY id DESC
        LIMIT 5
    """)

    rows = cursor.fetchall()

    for row in rows:
        print(row)

    conn.close()

    time.sleep(5)