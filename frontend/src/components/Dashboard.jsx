import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoFeed from './VideoFeed';
import StatusPanel from './StatusPanel';
import Alerts from './Alerts';
import FatigueTrendGraph from './FatigueTrendGraph';

const Dashboard = ({ driverId, sessionId, driverName, onLogout, onNavigateToHistory }) => {
    const [status, setStatus] = useState({
        state: "SAFE",
        ear: 0,
        pitch: 0,
        yaw: 0,
        is_alert: false,
        alertness_score: 100,
    });
    const [sleepProbability, setSleepProbability] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        if (!driverId) return;

        const fetchPrediction = async () => {
            try {
                const res = await fetch(`/api/driver-predictions/${driverId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.predictions && data.predictions.length > 0) {
                        setSleepProbability(data.predictions[0].sleep_probability);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch prediction", e);
            }
        };

        fetchPrediction();
        const interval = setInterval(fetchPrediction, 5000);
        return () => clearInterval(interval);
    }, [driverId]);

    useEffect(() => {
        if (sleepProbability > 0.75) {
            if (!audioRef.current) {
                audioRef.current = new Audio('/alarm.mp3');
                audioRef.current.loop = true;
            }
            if (audioRef.current.paused) {
                audioRef.current.play().catch(e => console.log("Audio requires interaction first", e));
            }
        } else {
            if (audioRef.current) {
                if (!audioRef.current.paused) {
                    audioRef.current.pause();
                }
                audioRef.current.currentTime = 0;
            }
        }
    }, [sleepProbability]);

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

    const metricsRef = useRef({
        blinkRate: 0,
        eyeClosureDuration: 0,
        yawnCount: 0,
        headStability: 100,
        score: 100
    });

    // Record Features Periodically
    useEffect(() => {
        if (!sessionId) return;

        const interval = setInterval(() => {
            const currentStatus = statusRef.current;
            const currentMetrics = metricsRef.current;

            const featureData = {
                session_id: sessionId,
                blink_rate: currentMetrics.blinkRate || 0,
                eye_closure_duration: currentMetrics.eyeClosureDuration || 0,
                yawn_probability: currentMetrics.yawnCount > 0 ? 1.0 : 0.0,
                head_pitch: currentStatus.pitch || 0,
                head_yaw: currentStatus.yaw || 0,
                head_roll: 0,
                eye_aspect_ratio: currentStatus.ear || 0,
                mouth_aspect_ratio: 0,
                consciousness_score: currentMetrics.score || 100,
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
                        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button onClick={onNavigateToHistory} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                                My Driving Status
                            </button>
                            <button onClick={handleEndSession} className="btn-logout" style={{ padding: '0.5rem 1rem' }}>
                                Terminate Session
                            </button>
                        </div>
                    </div>
                </header>

                {sleepProbability > 0.25 && (
                    <div style={{
                        padding: '1rem',
                        marginBottom: '2rem',
                        textAlign: 'center',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        border: `1px solid ${sleepProbability > 0.75 ? 'var(--color-danger)' : sleepProbability > 0.50 ? 'var(--color-warning)' : 'var(--color-safe)'}`,
                        color: sleepProbability > 0.75 ? 'var(--color-danger)' : sleepProbability > 0.50 ? 'var(--color-warning)' : 'var(--color-safe)',
                        backgroundColor: sleepProbability > 0.75 ? 'rgba(255, 51, 51, 0.1)' : sleepProbability > 0.50 ? 'rgba(212, 255, 0, 0.1)' : 'rgba(0, 255, 204, 0.1)',
                        boxShadow: `0 0 15px ${sleepProbability > 0.75 ? 'rgba(255, 51, 51, 0.3)' : sleepProbability > 0.50 ? 'rgba(212, 255, 0, 0.3)' : 'rgba(0, 255, 204, 0.3)'}`
                    }}>
                        {sleepProbability > 0.75
                            ? "High Sleep Risk – Stop and Rest Immediately"
                            : sleepProbability > 0.50
                                ? "Driver Fatigue Increasing – Consider Taking a Break"
                                : "Early Fatigue Detected – Stay Alert"
                        }
                    </div>
                )}

                <div className="dashboard-content">
                    <div className="video-section">
                        <VideoFeed onData={handleVideoData} />
                    </div>
                    <div className="control-section">
                        <StatusPanel status={status} onMetricsUpdate={(m) => metricsRef.current = m} />
                        {sessionId && (
                            <FatigueTrendGraph sessionId={sessionId} />
                        )}
                    </div>
                </div>
            </div>
            <Alerts isAlert={isStrongAlert} isWarning={isWarningAlert} />
        </div>
    );
};

export default Dashboard;
