import React, { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaBed } from 'react-icons/fa';
import classNames from 'classnames';

const StatusPanel = ({ status }) => {
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
    const backendScore =
        typeof alertness_score === 'number' ? alertness_score : null;

    // Fallback mapping from high-level state → approximate score when
    // backend score is missing or too optimistic for the current state.
    const fallbackScoreFromState = (() => {
        switch (state) {
            case "DROWSY":
                return 30;
            case "WARNING":
                return 60;
            case "SAFE":
                return 90;
            default:
                return 80;
        }
    })();

    let combinedScore;
    if (backendScore == null) {
        combinedScore = fallbackScoreFromState;
    } else if (state === "SAFE") {
        combinedScore = backendScore;
    } else {
        // When the high-level state indicates fatigue, do not show a score
        // higher than the state-based fallback to keep the gauge intuitive.
        combinedScore = Math.min(backendScore, fallbackScoreFromState);
    }

    const score = Math.max(0, Math.min(ALERTNESS_MAX, combinedScore));

    const yawningCount = typeof status.yawn_count === 'number' ? status.yawn_count : 0;

    const getGaugeColor = (value) => {
        if (value >= 75) return 'var(--color-safe)';
        if (value >= 60) return 'var(--color-warning-soft)';
        if (value >= 40) return 'var(--color-warning)';
        if (value >= 25) return 'var(--color-orange-deep)';
        return 'var(--color-danger)';
    };

    const getDriverStatusText = (value) => {
        if (value >= 80) return 'Fully Alert';
        if (value >= 65) return 'Mild Fatigue';
        if (value >= 45) return 'Drowsy';
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
                <div className="status-heading">
                    <span className="driver-status-label">Driver Status</span>
                    <h2 style={{ color: gaugeColor }}>{driverStatusText}</h2>
                </div>
                <div className="status-icon" style={{ color: getStatusColor(state) }}>
                    {getIcon(state)}
                </div>
            </div>

            <div className="alertness-section">
                <div className="alertness-gauge-wrapper">
                    <div className="gauge">
                        <div className="gauge-ring" />
                        <div
                            className="gauge-needle"
                            style={{
                                transform: `translate(-50%, -100%) rotate(${(score / 100) * 180 - 90}deg)`,
                                borderColor: gaugeColor,
                            }}
                        />
                        <div className="gauge-center" />
                        <div className="gauge-label">Alertness</div>
                        <div className="gauge-value" style={{ color: gaugeColor }}>
                            {score.toFixed(0)}
                        </div>
                    </div>
                </div>

                <div className="battery-indicator">
                    <div className="battery-body">
                        <div
                            className="battery-fill"
                            style={{
                                width: `${Math.max(5, score)}%`,
                                background: `linear-gradient(90deg, var(--color-safe), var(--color-warning-soft), var(--color-warning), var(--color-orange-deep), var(--color-danger))`,
                            }}
                        />
                    </div>
                    <div className="battery-cap" />
                    <span className="battery-label">Energy Reserve</span>
                </div>
            </div>

            <div className="metrics-grid dashboard-metrics-grid">
                <div className="metrics-row">
                    <div className="metric-card metric-chip">
                        <span className="metric-label">Blink Rate</span>
                        <span className="metric-value" style={{ color: blinkRateColor }}>
                            {blinkRate.toFixed(1)} <span className="metric-unit">blinks/min</span>
                        </span>
                    </div>
                    <div className="metric-card metric-chip">
                        <span className="metric-label">Eye Closure</span>
                        <span className="metric-value" style={{ color: eyeClosureColor }}>
                            {currentClosureDuration.toFixed(2)}{' '}
                            <span className="metric-unit">s</span>
                        </span>
                    </div>
                </div>
                <div className="metrics-row">
                    <div className="metric-card metric-chip">
                        <span className="metric-label">Yawning Count</span>
                        <span className="metric-value" style={{ color: yawningColor }}>
                            {yawningCount}{' '}
                            <span className="metric-unit">/ session</span>
                        </span>
                    </div>
                    <div className="metric-card metric-chip">
                        <span className="metric-label">Head Stability</span>
                        <span className="metric-value" style={{ color: headStabilityColor }}>
                            {headStability.toFixed(0)}{' '}
                            <span className="metric-unit">/ 100</span>
                        </span>
                    </div>
                </div>

                <div className="metrics-row raw-metrics-row">
                    <div className="metric-card">
                        <span className="metric-label">Eye Aspect Ratio</span>
                        <span className="metric-value mono">
                            {ear.toFixed(3)}
                        </span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{
                                    width: `${Math.min(ear * 100 * 3, 100)}%`,
                                    background:
                                        ear < 0.25 ? 'var(--color-danger)' : 'var(--color-safe)',
                                }}
                            />
                        </div>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Head Tilt</span>
                        <span className="metric-value mono">
                            {pitch.toFixed(1)}°
                        </span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{
                                    width: `${Math.min(Math.abs(pitch) * 2, 100)}%`,
                                    background:
                                        pitch < -10
                                            ? 'var(--color-danger)'
                                            : 'var(--color-primary)',
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="timeline-section">
                <div className="timeline-header">
                    <span className="metric-label">Fatigue Timeline</span>
                    <span className="timeline-window-label">Last 5 minutes</span>
                </div>
                <div className="timeline-chart">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="fatigueGradient" x1="0" x2="1" y1="0" y2="0">
                                <stop offset="0%" stopColor="var(--color-safe)" />
                                <stop offset="40%" stopColor="var(--color-warning-soft)" />
                                <stop offset="70%" stopColor="var(--color-warning)" />
                                <stop offset="100%" stopColor="var(--color-danger)" />
                            </linearGradient>
                        </defs>
                        <polyline
                            className="timeline-line"
                            fill="none"
                            stroke="url(#fatigueGradient)"
                            strokeWidth="1.5"
                            points={trendPoints}
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default StatusPanel;
