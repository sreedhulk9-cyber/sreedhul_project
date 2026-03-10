import time
import os
import sqlite3
import numpy as np
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PredictionSync")

class DrowsinessPredictor:
    """
    Lightweight Machine Learning model (Logistic Regression mock).
    Predicts p(sleep) based on behavioral features.
    """
    def __init__(self):
        # Coefficients representing a trained logistic regression model
        # Optimized for standardized input patterns
        self.weights = {
            "avg_blink_rate": 0.8,              # More blinking = higher fatigue
            "avg_eye_closure_duration": 3.5,     # Long closures = critical fatigue
            "avg_yawn_probability": 1.5,        # Yawning = high drowsiness
            "avg_head_pitch_neg": 0.6,          # Head nodding down = falling asleep
            "avg_consciousness_score_inv": -0.05, # Decreasing alertness = higher risk
        }
        self.bias = -3.0 # Base probability (log-odds) starts low

    def predict(self, features):
        """
        Calculates sleep probability [0, 1] and risk level.
        """
        z = self.bias
        z += (features.get("avg_blink_rate") or 0.0) * self.weights["avg_blink_rate"]
        z += (features.get("avg_eye_closure_duration") or 0.0) * self.weights["avg_eye_closure_duration"]
        z += (features.get("avg_yawn_probability") or 0.0) * self.weights["avg_yawn_probability"]
        
        # Head pitch is typically negative when nodding down.
        # We value the frequency and depth of head nodding.
        head_pitch = (features.get("avg_head_pitch") or 0.0)
        downward_nod = abs(min(0, head_pitch))
        z += downward_nod * self.weights["avg_head_pitch_neg"]
        
        # Consciousness score usually ranges from 0 to 100.
        z += (features.get("avg_consciousness_score") or 100.0) * self.weights["avg_consciousness_score_inv"]
        
        # Logistic sigmoid function
        probability = 1.0 / (1.0 + np.exp(-z))
        
        # Risk classification
        if probability < 0.3:
            risk = "low"
        elif probability < 0.7:
            risk = "medium"
        else:
            risk = "high"
            
        return float(probability), risk

predictor = DrowsinessPredictor()

def get_db_connection():
    # Database is in the database directory (backend/database/data.db)
    db_path = os.path.join(os.path.dirname(__file__), "database", "data.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def run_analytics_cycle():
    """
    Runs every 5 minutes to aggregate features and predict sleep risk.
    """
    logger.info("Executing periodic behavior analysis...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Identify all active driving sessions
        cursor.execute("SELECT session_id FROM driving_sessions WHERE end_time IS NULL")
        active_sessions = cursor.fetchall()
        
        if not active_sessions:
            logger.info("No active driving sessions found. Skipping cycle.")
            return

        for session in active_sessions:
            session_id = session['session_id']
            
            # 2. Calculate averages for the last 1 minute using SQLite's built-in time functions
            # to remain consistent with CURRENT_TIMESTAMP (UTC).
            cursor.execute('''
                SELECT 
                    AVG(blink_rate) as avg_blink_rate,
                    AVG(eye_closure_duration) as avg_eye_closure_duration,
                    AVG(yawn_probability) as avg_yawn_probability,
                    AVG(head_pitch) as avg_head_pitch,
                    AVG(head_yaw) as avg_head_yaw,
                    AVG(head_roll) as avg_head_roll,
                    AVG(consciousness_score) as avg_consciousness_score,
                    MIN(timestamp) as start_time,
                    MAX(timestamp) as end_time
                FROM driver_features
                WHERE session_id = ? AND timestamp >= datetime('now', '-1 minute')
            ''', (session_id,))
            
            averages = cursor.fetchone()
            
            # Verify data exists for the session in this window
            if averages is None or averages['avg_blink_rate'] is None:
                logger.info(f"Session {session_id} has insufficient data for this window.")
                continue
                
            # 3. Store the behavioral summary
            cursor.execute('''
                INSERT INTO driver_feature_summary (
                    session_id, start_time, end_time, avg_blink_rate, avg_eye_closure_duration, 
                    avg_yawn_probability, avg_head_pitch, avg_head_yaw, 
                    avg_head_roll, avg_consciousness_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id, 
                averages['start_time'], averages['end_time'],
                averages['avg_blink_rate'], averages['avg_eye_closure_duration'],
                averages['avg_yawn_probability'], averages['avg_head_pitch'],
                averages['avg_head_yaw'], averages['avg_head_roll'],
                averages['avg_consciousness_score']
            ))
            
            # 4. Generate Sleep Prediction
            prob, risk = predictor.predict(dict(averages))
            
            # 5. Store the prediction result
            cursor.execute('''
                INSERT INTO driver_sleep_predictions (
                    session_id, sleep_probability, risk_level
                ) VALUES (?, ?, ?)
            ''', (session_id, prob, risk))
            
            logger.info(f"Session {session_id} Analysis: SleepProb={prob:.2f}, Risk={risk.upper()}")

        conn.commit()
    except Exception as e:
        logger.error(f"Prediction Sync Failure: {e}")
    finally:
        conn.close()

def start_background_predictions():
    """
    Initializes and starts the background scheduler.
    """
    scheduler = BackgroundScheduler()
    # Run once immediately on start
    scheduler.add_job(run_analytics_cycle, 'date', run_date=datetime.now())
    # Then run every 1 minute
    scheduler.add_job(run_analytics_cycle, 'interval', minutes=1)
    scheduler.start()
    logger.info("Background Prediction Engine initialized.")
    return scheduler

if __name__ == "__main__":
    # Standalone execution logic
    sched = start_background_predictions()
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        sched.shutdown()
