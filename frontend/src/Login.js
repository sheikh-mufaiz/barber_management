import React, { useState } from "react";
import { API_URL } from "./api";

function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        setUser(data.user);
      } else {
        setMessage(data.message || "Login failed");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setMessage("Cannot reach server. Please make sure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-card">
      <div className="auth-form-card__header">
        <p className="auth-form-card__eyebrow">Welcome back</p>
        <h2>Sign in to your workspace</h2>
        <p>Return to your dashboard and pick up exactly where your queue, bookings, and shop day left off.</p>
      </div>

      <div className="auth-form-card__quick-notes">
        <div className="auth-note-card">
          <strong>Barber access</strong>
          <p>Open queue, analytics, chairs, services, and walk-ins from one dashboard.</p>
        </div>
        <div className="auth-note-card">
          <strong>Customer access</strong>
          <p>Book services, track your queue, and revisit history and loyalty details.</p>
        </div>
      </div>

      <form className="form-stack" onSubmit={login}>
        <label className="field-group">
          <span>Email Address</span>
          <input
            className="app-field auth-field"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field-group">
          <span>Password</span>
          <input
            className="app-field auth-field"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="app-button app-button--primary auth-submit" disabled={isLoading} type="submit">
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>

      {message ? <p className="form-feedback form-feedback--error">{message}</p> : null}
    </div>
  );
}

export default Login;
