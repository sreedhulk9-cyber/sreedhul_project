import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoFeed from './VideoFeed';
import StatusPanel from './StatusPanel';
import Alerts from './Alerts';

const Dashboard = ({ driverId, sessionId, driverName, onLogout }) => {
    const [status, setStatus] = useState({
        state: "SAFE",
        ear: 0,
        pitch: 0,
        yaw: 0,
        is_alert: false,
        alertness_score: 100,
    });
    const wsRef = useRef(null);
    const statusRef = useRef(status);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Connect to WebSocket
    useEffect(() => {
        const ws = new WebSocket(`ws://${window.location.host}/ws`);

        ws.onopen = () => {
            console.log("Connected to Backend");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatus(data);
            } catch (e) {
                console.error("Parse error", e);
            }
        };

        ws.onclose = () => {
            console.log("WS Closed");
        };

        wsRef.current = ws;

        return () => {
            ws.close();
        };
    }, []);

    const handleVideoData = useCallback((data) => {
        // Send data to backend for logic processing
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    // Record Features Periodically
    useEffect(() => {
        if (!sessionId) return;

        const interval = setInterval(() => {
            const currentStatus = statusRef.current;

            const featureData = {
                session_id: sessionId,
                blink_rate: 0,
                eye_closure_duration: 0,
                yawn_probability: 0,
                head_pitch: currentStatus.pitch || 0,
                head_yaw: currentStatus.yaw || 0,
                head_roll: 0,
                eye_aspect_ratio: currentStatus.ear || 0,
                mouth_aspect_ratio: 0,
                consciousness_score: currentStatus.alertness_score || 100,
                drowsiness_flag: currentStatus.is_alert || currentStatus.state === "DROWSY" ? 1 : 0
            };

            fetch('/api/record-driver-features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featureData)
            }).catch(err => console.error("Failed to record features", err));

        }, 1000); // 1 second intervals

        return () => clearInterval(interval);
    }, [sessionId]);

    const handleEndSession = async () => {
        if (sessionId) {
            try {
                await fetch('/api/end-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
            } catch (e) {
                console.error("Failed to end session", e);
            }
        }
        onLogout();
    };

    const isStrongAlert = status.is_alert || status.state === "DROWSY";
    const isWarningAlert = status.state === "WARNING";

    return (
        <div className={`app-container ${status.state === "DROWSY" ? "alert-mode" : ""}`}>
            <div className="glass-panel">
                <header>
                    <h1>
                        <span className="highlight">COLLECTION</span>
                        DRIVEGUARD 01™
                    </h1>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Authenticated Driver
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--color-frost)' }}>
                            {driverName}
                        </div>
                        <button onClick={handleEndSession} className="btn-logout" style={{ marginTop: '0.5rem' }}>
                            Terminate Session
                        </button>
                    </div>
                </header>

                <div className="dashboard-content">
                    <div className="video-section">
                        <VideoFeed onData={handleVideoData} />
                    </div>
                    <div className="control-section">
                        <StatusPanel status={status} />
                    </div>
                </div>
            </div>
            <Alerts isAlert={isStrongAlert} isWarning={isWarningAlert} />
        </div>
    );
};

export default Dashboard;
