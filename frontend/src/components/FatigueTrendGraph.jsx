import React, { useState, useEffect } from 'react';

const FatigueTrendGraph = ({ sessionId }) => {
    const [data, setData] = useState({ features: [], predictions: [] });

    useEffect(() => {
        if (!sessionId) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/fatigue-trend/${sessionId}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch fatigue trend data", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000); // Update every 3 seconds
        return () => clearInterval(interval);
    }, [sessionId]);

    // Data processing and SVG scaling
    const graphWidth = 600;
    const graphHeight = 120; // Reduced height
    const padding = 15;

    // We want the last 5 minutes (300 seconds), but the data might not cover exactly 300s.
    // Let's use the current time and current time minus 5 minutes to set the X-axis bounds.
    const now = new Date();
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const timeRange = now.getTime() - fiveMinsAgo.getTime();

    const getX = (timestampStr) => {
        // Assume timestamp in SQLite is UTC, replace space with T and append 'Z' for valid ISO string
        const t = new Date(timestampStr.replace(' ', 'T') + 'Z').getTime();
        const ratio = (t - fiveMinsAgo.getTime()) / timeRange;
        // Clamp between 0 and 1 just in case
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        return padding + clampedRatio * (graphWidth - 2 * padding);
    };

    const getYAlertness = (score) => {
        // Score is 0 to 100
        const ratio = score / 100;
        return graphHeight - padding - (ratio * (graphHeight - 2 * padding));
    };

    const getYSleep = (prob) => {
        // Prob is 0 to 1
        const ratio = prob; // max is 1
        return graphHeight - padding - (ratio * (graphHeight - 2 * padding));
    };

    // Construct path segments
    const createPath = (dataset, getXFunc, getYFunc, valueKey) => {
        if (!dataset || dataset.length === 0) return '';
        return dataset.map((d, i) => {
            const x = getXFunc(d.timestamp);
            const y = getYFunc(d[valueKey]);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    const alertnessPath = createPath(data.features, getX, getYAlertness, 'alertness_score');
    const sleepPath = createPath(data.predictions, getX, getYSleep, 'sleep_probability');

    return (
        <div style={{
            background: 'rgba(5, 10, 20, 0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 255, 204, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            color: 'var(--color-text)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 0 10px rgba(0, 255, 204, 0.05)'
        }}>
            <h3 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1rem',
                color: 'var(--color-frost)',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem'
            }}>
                <span className="pulsing-dot" style={{ background: 'var(--color-accent)' }}></span>
                Fatigue Trend &ndash; Last 5 Minutes
            </h3>

            <div style={{ position: 'relative', height: '120px', width: '100%' }}>
                <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>

                    {/* Grid lines (horizontal) */}
                    {[0, 25, 50, 75, 100].map((val, index) => {
                        const sleepVals = [0, 0.25, 0.5, 0.75, 1];
                        return (
                            <g key={val}>
                                <line
                                    x1={padding}
                                    y1={getYAlertness(val)}
                                    x2={graphWidth - padding}
                                    y2={getYAlertness(val)}
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="1"
                                />
                                {/* Left Label: Alertness */}
                                <text
                                    x={padding - 5}
                                    y={getYAlertness(val) + 4}
                                    fill="rgba(0, 255, 204, 0.6)"
                                    fontSize="9"
                                    textAnchor="end"
                                >
                                    {val}
                                </text>
                                {/* Right Label: Sleep Prob */}
                                <text
                                    x={graphWidth - padding + 5}
                                    y={getYAlertness(val) + 4}
                                    fill="rgba(255, 51, 51, 0.6)"
                                    fontSize="9"
                                    textAnchor="start"
                                >
                                    {sleepVals[index]}
                                </text>
                            </g>
                        )
                    })}

                    <text x={padding} y={padding - 10} fill="rgba(0, 255, 204, 0.8)" fontSize="9">Alertness Score</text>
                    <text x={graphWidth - padding} y={padding - 10} fill="rgba(255, 51, 51, 0.8)" fontSize="9" textAnchor="end">Sleep Prob.</text>

                    {/* SVG Filters for Glow Effect */}
                    <defs>
                        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Alertness Graph Line */}
                    {alertnessPath && (
                        <path
                            d={alertnessPath}
                            fill="none"
                            stroke="var(--color-safe)"
                            strokeWidth="2"
                            filter="url(#glow-cyan)"
                        />
                    )}

                    {/* Sleep Probability Graph Line */}
                    {sleepPath && (
                        <path
                            d={sleepPath}
                            fill="none"
                            stroke="var(--color-danger)"
                            strokeWidth="2"
                            filter="url(#glow-red)"
                        />
                    )}
                </svg>
            </div>

            {/* Legend layout */}
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-safe)', boxShadow: '0 0 8px var(--color-safe)' }}></div>
                    <span style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Alertness Score</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-danger)', boxShadow: '0 0 8px var(--color-danger)' }}></div>
                    <span style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sleep Probability</span>
                </div>
            </div>
        </div>
    );
};

export default FatigueTrendGraph;
