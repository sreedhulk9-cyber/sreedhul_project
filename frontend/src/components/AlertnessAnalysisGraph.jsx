import React from 'react';

const AlertnessAnalysisGraph = ({ trendPoints }) => {
    return (
        <div className="timeline-section" style={{ marginTop: 'auto' }}>
            <div className="timeline-header">
                <span className="metric-label">ALERTNESS ANALYSIS GRAPH</span>
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
                        style={{ filter: 'drop-shadow(0 0 4px var(--color-safe))' }}
                    />
                </svg>
            </div>
        </div>
    );
};

export default AlertnessAnalysisGraph;
