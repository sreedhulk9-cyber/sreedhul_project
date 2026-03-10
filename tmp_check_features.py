import sqlite3
import os

db_path = "backend/data.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM driver_features ORDER BY timestamp DESC LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(dict(row))
    conn.close()
else:
    print("Database not found")
