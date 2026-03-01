import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoFeed from './components/VideoFeed';
import StatusPanel from './components/StatusPanel';
import Alerts from './components/Alerts';
import './App.css';

function App() {
  const [status, setStatus] = useState({
    state: "SAFE",
    ear: 0,
    pitch: 0,
    yaw: 0,
    is_alert: false,
    alertness_score: 100,
  });
  const wsRef = useRef(null);

  // Connect to WebSocket
  useEffect(() => {
    // In production, use window.location.hostname
    const ws = new WebSocket("ws://localhost:8000/ws");

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
      // Reconnect logic implementation needed for robust prod
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

    // For immediate UI feedback (optional, but relying on backend provided 'status' ensures consistency)
    // We update local display with raw values, but state comes from backend
    // Actually, to avoid lag, let's wait for backend response
  }, []);

  const isStrongAlert = status.is_alert || status.state === "DROWSY";
  const isWarningAlert = status.state === "WARNING";

  return (
    <div className={`app-container ${status.state === "DROWSY" ? "alert-mode" : ""}`}>
      <div className="glass-panel">
        <header>
          <h1><span className="highlight">DriveGuard</span></h1>
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
}

export default App;
