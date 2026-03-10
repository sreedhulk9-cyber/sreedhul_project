import React, { useState, useEffect } from 'react';

const MyDrivingStatus = ({ driverId, onBack }) => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                const res = await fetch(`/api/driver-predictions/${driverId}`);
                const data = await res.json();
                if (res.ok) {
                    setPredictions(data.predictions || []);
                } else {
                    console.error("Failed to fetch predictions", data);
                }
            } catch (err) {
                console.error("Error fetching predictions", err);
            } finally {
                setLoading(false);
            }
        };

        if (driverId) {
            fetchPredictions();
        }
    }, [driverId]);

    const formatTimestamp = (ts) => {
        if (!ts) return "Unknown";
        const d = new Date(ts + 'Z'); // parse as UTC since sqlite typically stores naive UTC timestamp
        return d.toLocaleString();
    };

    return (
        <div className="app-container">
            <div className="glass-panel" style={{ overflowY: 'auto' }}>
                <header>
                    <h1>
                        <span className="highlight">COLLECTION</span>
                        DRIVEGUARD 01™ HISTORY
                    </h1>
                    <div style={{ textAlign: 'right' }}>
                        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '0.5rem' }}>
                            Back to Dashboard
                        </button>
                    </div>
                </header>

                <div style={{ padding: '0 2rem' }}>
                    {loading ? (
                        <p style={{ color: 'var(--color-frost)' }}>Loading your history...</p>
                    ) : predictions.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No driving history or predictions found yet. Start driving to collect data!</p>
                    ) : (
                        <div style={{ overflowX: 'auto', background: 'rgba(0, 255, 204, 0.05)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(0, 255, 204, 0.2)' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--color-text)' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(0, 255, 204, 0.4)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--color-safe)' }}>TIME</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-safe)' }}>SESSION START</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-safe)' }}>SLEEP PROBABILITY</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-safe)' }}>RISK LEVEL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {predictions.map((p, i) => (
                                        <tr key={p.id || i} style={{ borderBottom: '1px solid rgba(0, 255, 204, 0.1)' }}>
                                            <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)' }}>{formatTimestamp(p.timestamp)}</td>
                                            <td style={{ padding: '1rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{formatTimestamp(p.session_start_time)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{(p.sleep_probability * 100).toFixed(1)}%</td>
                                            <td style={{
                                                padding: '1rem',
                                                color: p.risk_level === 'HIGH' ? 'var(--color-danger)' :
                                                    p.risk_level === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-safe)',
                                                fontWeight: 'bold',
                                                textShadow: p.risk_level === 'HIGH' ? '0 0 10px var(--color-danger)' :
                                                    p.risk_level === 'MEDIUM' ? '0 0 10px var(--color-warning)' : '0 0 10px var(--color-safe)'
                                            }}>
                                                {p.risk_level}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyDrivingStatus;
