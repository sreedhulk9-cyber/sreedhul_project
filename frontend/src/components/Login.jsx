import React, { useState } from 'react';

const Login = ({ onLogin, onNavigateToSignup }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                onLogin(data.driver_id, username);
            } else {
                setError(data.detail || 'Login failed');
            }
        } catch (err) {
            setError('Connection error. Is the backend running?');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-panel">
                <h2>Login</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message" style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</div>}
                    <input
                        type="text"
                        placeholder="USERNAME"
                        className="auth-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="PASSWORD"
                        className="auth-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn-primary">
                        Enter System
                    </button>
                </form>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    New driver? <span onClick={onNavigateToSignup} style={{ color: 'var(--color-frost)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Register</span>
                </p>
            </div>
        </div>
    );
};

export default Login;
