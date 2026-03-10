import sqlite3
import os

db_path = "backend/data.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", [t[0] for t in tables])
    for table in [t[0] for t in tables]:
        cursor.execute(f"PRAGMA table_info({table})")
        cols = cursor.fetchall()
        print(f"Table {table} columns:", [c[1] for c in cols])
    conn.close()
else:
    print("Database not found")
