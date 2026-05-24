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
      <div>
        {showRegister ? <Register /> : <Login setUser={setUser} />}

        <button onClick={() => setShowRegister(!showRegister)}>
          {showRegister ? "Go to Login" : "Go to Register"}
        </button>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div>
        <h2>Welcome {user.name}</h2>

        <button onClick={() => {
          localStorage.removeItem("user");
          setUser(null);
        }}>
          Logout
        </button>

        {user.role === "barber" ? (
          <BarberDashboard />
        ) : (
          <Booking />
        )}
      </div>
    </NotificationProvider>
  );
}
export default App;
