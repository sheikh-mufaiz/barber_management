import React, { useState } from "react";
import { API_URL } from "./api";

function Register({ onRegistered }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  // 🔥 barber fields
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState("");

  const setFeedback = (nextMessage, type = "success") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  // 📍 Get Location
  const getLocation = () => {
    setIsCapturingLocation(true);
    setFeedback("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setFeedback("Location captured successfully.", "success");
        setIsCapturingLocation(false);
      },
      () => {
        setFeedback("Location permission denied. You can still register and add it later.", "error");
        setIsCapturingLocation(false);
      }
    );
  };

  // 🔥 Register API
  const register = async (event) => {
    event.preventDefault();

    if (!name || !email || !password) {
      setFeedback("Fill all required fields.", "error");
      return;
    }

    if (role === "barber" && (!shopName || !phone || !address)) {
      setFeedback("Fill all barber details before creating the account.", "error");
      return;
    }

    setIsLoading(true);
    setFeedback("");

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          shopName,
          phone,
          location,
          address
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback(data.message || "Registration failed.", "error");
        return;
      }

      setFeedback(data.message || "Account created successfully. You can sign in now.", "success");

      setName("");
      setEmail("");
      setPassword("");
      setRole("customer");
      setShopName("");
      setPhone("");
      setLocation(null);
      setAddress("");

      if (onRegistered) {
        window.setTimeout(() => onRegistered(), 900);
      }
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      setFeedback("Cannot reach server. Please make sure backend is running.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-card auth-form-card--wide">
      <div className="auth-form-card__header">
        <p className="auth-form-card__eyebrow">Create account</p>
        <h2>Join the queue experience</h2>
        <p>Create a customer profile or launch a barber workspace with shop details, location, and a stronger first impression.</p>
      </div>

      <div className="auth-role-grid">
        <button
          className={`auth-role-card ${role === "customer" ? "auth-role-card--active" : ""}`}
          onClick={() => setRole("customer")}
          type="button"
        >
          <span className="auth-role-card__eyebrow">Customer</span>
          <strong>Book and track visits</strong>
          <p>Choose services, follow your queue, and review loyalty and visit history.</p>
        </button>

        <button
          className={`auth-role-card ${role === "barber" ? "auth-role-card--active" : ""}`}
          onClick={() => setRole("barber")}
          type="button"
        >
          <span className="auth-role-card__eyebrow">Barber</span>
          <strong>Manage shop operations</strong>
          <p>Open a barber workspace with queue control, analytics, chairs, services, and walk-ins.</p>
        </button>
      </div>

      <form className="form-stack" onSubmit={register}>
        <div className="form-grid">
          <label className="field-group">
            <span>Full Name</span>
            <input
              className="app-field auth-field"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

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
              placeholder="Create a password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className="field-group">
            <span>Account Type</span>
            <input className="app-field auth-field auth-field--readonly" readOnly value={role === "barber" ? "Barber workspace" : "Customer account"} />
          </label>
        </div>

        {role === "barber" && (
          <div className="editorial-panel auth-editorial-panel">
            <div className="editorial-panel__header">
              <h3>Barber Setup</h3>
              <p>Add the shop details customers will see when they browse and book with you.</p>
            </div>

            <div className="form-grid">
              <label className="field-group">
                <span>Shop Name</span>
                <input
                  className="app-field auth-field"
                  placeholder="Fade District Studio"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Phone Number</span>
                <input
                  className="app-field auth-field"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              <label className="field-group field-group--full">
                <span>Shop Address</span>
                <input
                  className="app-field auth-field"
                  placeholder="Street, area, city"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="app-button app-button--secondary" disabled={isCapturingLocation} onClick={getLocation} type="button">
                {isCapturingLocation ? "Capturing location..." : "Capture Current Location"}
              </button>
              <div className="auth-location-pill">
                {location ? "Location ready for shop discovery" : "Location optional but helpful for discovery"}
              </div>
            </div>
          </div>
        )}

        <button className="app-button app-button--primary auth-submit" disabled={isLoading} type="submit">
          {isLoading ? "Creating account..." : "Register"}
        </button>
      </form>

      {message ? (
        <p className={`form-feedback ${messageType === "error" ? "form-feedback--error" : "form-feedback--success"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default Register;
