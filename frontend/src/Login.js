import React, { useState } from "react";

function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const login = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setMessage(data.message || "Login failed");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setMessage("Cannot reach server. Please make sure backend is running.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Login</h2>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={login}>Login</button>

      <p>{message}</p>
    </div>
  );
}

export default Login;
