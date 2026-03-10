import React, { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaBed } from 'react-icons/fa';
import classNames from 'classnames';

const StatusPanel = ({ status, onMetricsUpdate }) => {
    // status: { state, ear, pitch, yaw, is_alert, alertness_score?, yawn_count? }
    const { state, ear = 0, pitch = 0, yaw = 0, alertness_score } = status;

    const [blinkRate, setBlinkRate] = useState(0); // blinks per minute
    const [currentClosureDuration, setCurrentClosureDuration] = useState(0); // seconds
    const [headStability, setHeadStability] = useState(100); // 0–100 (higher = more stable)
    const [timelineSamples, setTimelineSamples] = useState([]);

    const eyesClosedRef = useRef(false);
    const eyeChangeTsRef = useRef(null);
    const blinkEventsRef = useRef([]);
    const headHistoryRef = useRef([]);

    const nowSeconds = () => Date.now() / 1000;

    const ALERTNESS_MAX = 100;
    const backendScore = typeof alertness_score === 'number' ? alertness_score : 100;
    const yawningCount = typeof status.yawn_count === 'number' ? status.yawn_count : 0;

    let calculatedScore = backendScore;

    // Apply continuous deductions based on real-time metrics
    if (currentClosureDuration > 0.2) calculatedScore -= (currentClosureDuration * 15);
    if (blinkRate > 20) calculatedScore -= (blinkRate - 15);
    if (yawningCount > 0) calculatedScore -= (yawningCount * 5);
    if (headStability < 90) calculatedScore -= ((100 - headStability) * 0.5);

    // Apply explicit threshold checks to enforce risk bounds
    let riskCategory = "LOW";

    // HIGH Risk Bounds
    if (
        currentClosureDuration > 1.0 ||
        blinkRate > 30 ||
        yawningCount >= 3 ||
        headStability < 50 ||
        calculatedScore < 50
    ) {
        riskCategory = "HIGH";
        if (calculatedScore >= 50) calculatedScore = 45; // force below 50
    }
    // MEDIUM Risk Bounds
    else if (
        currentClosureDuration > 0.4 ||
        blinkRate > 22 ||
        yawningCount >= 1 ||
        headStability < 75 ||
        calculatedScore < 80
    ) {
        riskCategory = "MEDIUM";
        if (calculatedScore >= 80) calculatedScore = 75; // force below 80
        if (calculatedScore < 50) calculatedScore = 55; // force above 50
    }
    // LOW Risk Bounds
    else {
        riskCategory = "LOW";
        if (calculatedScore < 80) calculatedScore = 85; // force above 80
    }

    const score = Math.max(0, Math.min(ALERTNESS_MAX, calculatedScore));

    const getGaugeColor = (value) => {
        if (value >= 80) return 'var(--color-safe)';
        if (value >= 50) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const getDriverStatusText = (value) => {
        if (value >= 80) return 'Driver Alert';
        if (value >= 50) return 'Stay Focused';
        return 'High Risk – Take a Break';
    };

    const getStatusColor = (s) => {
        switch (s) {
            case "SAFE": return "var(--color-safe)";
            case "WARNING": return "var(--color-warning)";
            case "DROWSY": return "var(--color-danger)";
            default: return "var(--color-text)";
        }
    };

    const getIcon = (s) => {
        switch (s) {
            case "SAFE": return <FaCheckCircle />;
            case "WARNING": return <FaExclamationTriangle />;
            case "DROWSY": return <FaBed />;
            default: return null;
        }
    };

    // Derive blink metrics, head stability, and timeline history from incoming status
    useEffect(() => {
        const now = nowSeconds();

        // --- Blink metrics (based on EAR threshold consistent with backend) ---
        const earThreshold = 0.25;
        const closed = ear < earThreshold;

        if (closed && !eyesClosedRef.current) {
            eyesClosedRef.current = true;
            eyeChangeTsRef.current = now;
        } else if (!closed && eyesClosedRef.current) {
            if (eyeChangeTsRef.current != null) {
                const duration = Math.max(0, now - eyeChangeTsRef.current);
                blinkEventsRef.current.push({ time: now, duration });
            }
            eyesClosedRef.current = false;
            eyeChangeTsRef.current = now;
        }

        // Current continuous eye-closure duration
        if (eyesClosedRef.current && eyeChangeTsRef.current != null) {
            setCurrentClosureDuration(Math.max(0, now - eyeChangeTsRef.current));
        } else {
            setCurrentClosureDuration(0);
        }

        // Keep blink history within the last 60 seconds
        const blinkWindowSec = 60;
        blinkEventsRef.current = blinkEventsRef.current.filter(
            (b) => b.time >= now - blinkWindowSec
        );
        const blinkCount = blinkEventsRef.current.length;
        const ratePerMin = (blinkCount / blinkWindowSec) * 60;
        setBlinkRate(ratePerMin);

        // --- Head movement stability (lower variance => more stable) ---
        const headWindowSec = 30;
        headHistoryRef.current.push({ time: now, yaw, pitch });
        headHistoryRef.current = headHistoryRef.current.filter(
            (h) => h.time >= now - headWindowSec
        );

        const history = headHistoryRef.current;
        if (history.length > 1) {
            const meanYaw =
                history.reduce((sum, h) => sum + h.yaw, 0) / history.length;
            const meanPitch =
                history.reduce((sum, h) => sum + h.pitch, 0) / history.length;

            const varYaw =
                history.reduce((sum, h) => sum + (h.yaw - meanYaw) ** 2, 0) /
                history.length;
            const varPitch =
                history.reduce((sum, h) => sum + (h.pitch - meanPitch) ** 2, 0) /
                history.length;

            const movementIndex = Math.sqrt(varYaw + varPitch); // degrees
            // Map movementIndex to stability 0–100 (0 = very unstable, 100 = very stable)
            const stability = Math.max(
                0,
                Math.min(100, 100 - movementIndex * 2)
            );
            setHeadStability(stability);
        } else {
            setHeadStability(100);
        }

        // --- Fatigue timeline: keep last 5 minutes of alertness score ---
        const timelineWindowSec = 300;
        setTimelineSamples((prev) => {
            const updated = [...prev, { time: now, score }];
            return updated.filter((p) => p.time >= now - timelineWindowSec);
        });
    }, [ear, pitch, yaw, score]);

    useEffect(() => {
        if (onMetricsUpdate) {
            onMetricsUpdate({
                blinkRate,
                eyeClosureDuration: currentClosureDuration,
                yawnCount: yawningCount,
                headStability,
                score
            });
        }
    }, [blinkRate, currentClosureDuration, yawningCount, headStability, score, onMetricsUpdate]);

    const trendPoints = (() => {
        if (!timelineSamples.length) return '';
        const now = nowSeconds();
        const windowSec = 300;
        return timelineSamples
            .map((p) => {
                const xNorm = (p.time - (now - windowSec)) / windowSec;
                const x = Math.max(0, Math.min(1, xNorm)) * 100;
                const y = 100 - (Math.max(0, Math.min(100, p.score)) * 0.8 + 10);
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    })();

    const gaugeColor = getGaugeColor(score);
    const driverStatusText = getDriverStatusText(score);

    // Simple qualitative analysis for per-metric colouring
    const blinkRateColor =
        blinkRate > 30 ? 'var(--color-danger)' :
            blinkRate > 20 ? 'var(--color-warning)' :
                'var(--color-safe)';

    const eyeClosureColor =
        currentClosureDuration > 1 ? 'var(--color-danger)' :
            currentClosureDuration > 0.3 ? 'var(--color-warning)' :
                'var(--color-safe)';

    const yawningColor =
        yawningCount > 3 ? 'var(--color-danger)' :
            yawningCount > 0 ? 'var(--color-warning)' :
                'var(--color-safe)';

    const headStabilityColor =
        headStability < 60 ? 'var(--color-danger)' :
            headStability < 80 ? 'var(--color-warning)' :
                'var(--color-safe)';

    return (
        <div className={classNames("status-panel", { "status-drowsy": state === "DROWSY" })}>
            <div className="status-header">
                <span className="driver-status-label">Condition Monitoring</span>
                <h2 style={{ color: gaugeColor }}>{driverStatusText}</h2>
            </div>

            <div className="alertness-section">
                <div className="alertness-heading">
                    <span className="alertness-label">Alertness Level</span>
                    <span className="alertness-value" style={{ color: gaugeColor }}>{score.toFixed(0)}</span>
                </div>
                <div className="battery-indicator">
                    <div className="battery-body">
                        <div
                            className="battery-fill"
                            style={{
                                width: `${Math.max(8, score)}%`,
                                background: score < 50 ? 'var(--color-danger)' : 'linear-gradient(90deg, var(--color-frost) 0%, #fff 100%)',
                                boxShadow: score > 50 ? '0 0 20px rgba(0, 255, 204, 0.4)' : '0 0 20px rgba(255, 51, 51, 0.6)'
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <span className="metric-label">EYE CLOSURE</span>
                    <span className="metric-value" style={{ color: eyeClosureColor }}>
                        {currentClosureDuration.toFixed(2)}s
                    </span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">BLINK RATE</span>
                    <span className="metric-value" style={{ color: blinkRateColor }}>
                        {blinkRate.toFixed(1)}
                    </span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">HEAD STABILITY</span>
                    <span className="metric-value" style={{ color: headStabilityColor }}>
                        {headStability.toFixed(0)}%
                    </span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">YAWN COUNT</span>
                    <span className="metric-value" style={{ color: yawningColor }}>
                        {yawningCount}
                    </span>
                </div>
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div className="timeline-section">
                    <div className="timeline-header">
                        <span className="metric-label">FATIGUE HISTORY</span>
                        <span className="metric-label" style={{ opacity: 0.5 }}>Last 5M</span>
                    </div>
                    <div className="timeline-chart">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polyline
                                className="timeline-line"
                                fill="none"
                                stroke="var(--color-frost)"
                                strokeWidth="2"
                                points={trendPoints}
                            />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatusPanel;
