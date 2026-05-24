import React, { useState, useEffect } from "react";
import "./App.css";
import Login from "./Login";
import Register from "./Register";
import Booking from "./Booking";
import BarberDashboard from "./BarberDashboard";
import { NotificationProvider } from "./NotificationContext";

function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // 🔥 Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-shell__panel">
          <div className="auth-shell__header">
            <p className="dashboard-shell__eyebrow">Queue Manager</p>
            <h1 className="auth-shell__title">Appointments, queues, and chair flow in one place.</h1>
            <p className="auth-shell__copy">
              Sign in to manage the shop floor or book your next visit with a cleaner dashboard
              experience.
            </p>
          </div>

          {showRegister ? <Register /> : <Login setUser={setUser} />}

          <button className="auth-shell__toggle" onClick={() => setShowRegister(!showRegister)}>
            {showRegister ? "Go to Login" : "Go to Register"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className="app-shell">
        {user.role === "barber" ? (
          <BarberDashboard
            user={user}
            onLogout={() => {
              localStorage.removeItem("user");
              setUser(null);
            }}
          />
        ) : (
          <Booking
            user={user}
            onLogout={() => {
              localStorage.removeItem("user");
              setUser(null);
            }}
          />
        )}
      </div>
    </NotificationProvider>
  );
}
export default App;
