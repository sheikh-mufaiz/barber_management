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
  const authHighlights = [
    {
      value: "Live Queue",
      label: "Track wait time, active chairs, and in-progress work without juggling screens."
    },
    {
      value: "Premium Booking",
      label: "Customers can book services, review history, and follow shop updates from one flow."
    },
    {
      value: "Smart Analytics",
      label: "Barbers get custom date ranges, history filters, and snapshot-backed revenue context."
    }
  ];

  // 🔥 Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
    };

    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, []);

  if (!user) {
    return (
      <div className="auth-shell auth-shell--warm-premium">
        <div className="auth-shell__panel">
          <div className="auth-shell__hero">
            <div className="auth-shell__header">
              <p className="dashboard-shell__eyebrow">Queue Manager</p>
              <h1 className="auth-shell__title">Sharper bookings, calmer queue flow, better shop mornings.</h1>
              <p className="auth-shell__copy">
                A polished barber booking workspace for customers and shop teams, built around live
                queue clarity, cleaner scheduling, and better day-to-day operations.
              </p>

              <div className="auth-shell__highlight-grid">
                {authHighlights.map((item) => (
                  <article key={item.value} className="auth-shell__highlight-card">
                    <strong>{item.value}</strong>
                    <p>{item.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="auth-shell__feature-card">
              <p className="auth-shell__feature-label">Fresh auth experience</p>
              <h2>One entrance for both sides of the product.</h2>
              <p>
                Sign in for daily operations, or launch a new customer or barber account with a
                clearer, more guided onboarding surface.
              </p>
              <div className="auth-shell__feature-metrics">
                <div>
                  <span>For barbers</span>
                  <strong>Queue, chairs, walk-ins</strong>
                </div>
                <div>
                  <span>For customers</span>
                  <strong>Booking, history, loyalty</strong>
                </div>
              </div>
            </aside>
          </div>

          <div className="auth-shell__mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              className={`auth-shell__mode-button ${!showRegister ? "auth-shell__mode-button--active" : ""}`}
              onClick={() => setShowRegister(false)}
              type="button"
            >
              Login
            </button>
            <button
              className={`auth-shell__mode-button ${showRegister ? "auth-shell__mode-button--active" : ""}`}
              onClick={() => setShowRegister(true)}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {showRegister ? <Register onRegistered={() => setShowRegister(false)} /> : <Login setUser={setUser} />}
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
              localStorage.removeItem("token");
              setUser(null);
            }}
          />
        ) : (
          <Booking
            user={user}
            onLogout={() => {
              localStorage.removeItem("user");
              localStorage.removeItem("token");
              setUser(null);
            }}
          />
        )}
      </div>
    </NotificationProvider>
  );
}
export default App;
