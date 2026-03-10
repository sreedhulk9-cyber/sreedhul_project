from backend.database.models import init_db
import sys
import os

# Add the project root to sys.path so we can import 'backend'
sys.path.append(os.getcwd())

try:
    init_db()
    print("Database initialized successfully.")
except Exception as e:
    print(f"Error initializing database: {e}")
