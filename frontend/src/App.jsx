import React, { useState } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import MyDrivingStatus from './components/MyDrivingStatus';
import './App.css';

function App() {
  const [view, setView] = useState('login'); // 'login', 'signup', 'dashboard'
  const [driverId, setDriverId] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [sessionId, setSessionId] = useState(null);

  const startSession = async (loggedInDriverId) => {
    try {
      const response = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: loggedInDriverId })
      });
      const data = await response.json();
      if (response.ok) {
        setSessionId(data.session_id);
      } else {
        console.error("Failed to start session:", data);
      }
    } catch (err) {
      console.error("Connection error while starting session", err);
    }
  };

  const handleLogin = (id, name) => {
    setDriverId(id);
    setDriverName(name);
    startSession(id);
    setView('dashboard');
  };

  const handleLogout = () => {
    setDriverId(null);
    setDriverName('');
    setSessionId(null);
    setView('login');
  };

  return (
    <div className="main-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {view === 'login' && (
        <Login
          onLogin={handleLogin}
          onNavigateToSignup={() => setView('signup')}
        />
      )}
      {view === 'signup' && (
        <Signup
          onNavigateToLogin={() => setView('login')}
        />
      )}
      {view === 'dashboard' && (
        <Dashboard
          driverId={driverId}
          sessionId={sessionId}
          driverName={driverName}
          onLogout={handleLogout}
          onNavigateToHistory={() => setView('history')}
        />
      )}
      {view === 'history' && (
        <MyDrivingStatus
          driverId={driverId}
          onBack={() => setView('dashboard')}
        />
      )}
    </div>
  );
}

export default App;
