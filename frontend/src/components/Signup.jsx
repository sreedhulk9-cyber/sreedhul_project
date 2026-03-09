import React, { useState } from 'react';

const Signup = ({ onNavigateToLogin }) => {
    const [driverName, setDriverName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driver_name: driverName,
                    username,
                    password,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Signup successful! You can now login.');
                setDriverName('');
                setUsername('');
                setPassword('');
                setConfirmPassword('');
            } else {
                setError(data.detail || 'Signup failed');
            }
        } catch (err) {
            setError('Connection error. Is the backend running?');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-panel">
                <h2>Signup</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message" style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</div>}
                    {success && <div className="success-message" style={{ color: 'var(--color-safe)', marginBottom: '1rem' }}>{success}</div>}
                    <input
                        type="text"
                        placeholder="FULL NAME"
                        className="auth-input"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                    />
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
                    <input
                        type="password"
                        placeholder="CONFIRM PASSWORD"
                        className="auth-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn-primary">
                        Create Account
                    </button>
                </form>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    Already registered? <span onClick={onNavigateToLogin} style={{ color: 'var(--color-frost)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Log in</span>
                </p>
            </div>
        </div>
    );
};

export default Signup;
