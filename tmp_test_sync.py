import sys
import os
import sqlite3
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from prediction_sync import run_analytics_cycle

# Run cycle
print("Running analytics cycle...")
run_analytics_cycle()

db_path = "backend/data.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT * FROM summarized_driver_behavior ORDER BY id DESC LIMIT 2")
summaries = cursor.fetchall()

cursor.execute("SELECT * FROM driver_sleep_predictions ORDER BY id DESC LIMIT 2")
predictions = cursor.fetchall()

print("\n--- Latest Summarized Behavior ---")
for s in summaries:
    print(dict(s))

print("\n--- Latest Sleep Predictions ---")
for p in predictions:
    print(dict(p))

conn.close()
