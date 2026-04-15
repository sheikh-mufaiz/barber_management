import React, { useState } from "react";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");

  // 🔥 barber fields
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(""); // ✅ NEW

  // 📍 Get Location
  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        alert("Location captured ✅");
      },
      () => {
        alert("Location permission denied ❌");
      }
    );
  };

  // 🔥 Register API
  const register = async () => {
    // 🔥 Basic validation
    if (!name || !email || !password) {
      alert("Fill all required fields");
      return;
    }

    if (role === "barber" && (!shopName || !phone || !address)) {
      alert("Fill all barber details");
      return;
    }

    const res = await fetch("http://localhost:5000/api/register", {
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
        address // ✅ NEW FIELD
      })
    });

    const data = await res.json();
    alert(data.message);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Register</h2>

      <input
        placeholder="Name"
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <select onChange={(e) => setRole(e.target.value)}>
        <option value="customer">Customer</option>
        <option value="barber">Barber</option>
      </select>

      {/* 🔥 BARBER SECTION */}
      {role === "barber" && (
        <>
          <input
            placeholder="Shop Name"
            onChange={(e) => setShopName(e.target.value)}
          />

          <input
            placeholder="Phone Number"
            onChange={(e) => setPhone(e.target.value)}
          />

          {/* 🆕 Address */}
          <input
            placeholder="Shop Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          {/* 📍 Location */}
          <button onClick={getLocation}>
            Get Location 📍
          </button>

          {location && (
            <p>
              📍 Lat: {location.lat}, Lng: {location.lng}
            </p>
          )}
        </>
      )}

      <br /><br />

      <button onClick={register}>Register</button>
    </div>
  );
}

export default Register;