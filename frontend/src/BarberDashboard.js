import React, { useState, useEffect } from "react";

function BarberDashboard() {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [services, setServices] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [bookings, setBookings] = useState([]);

  const [customerName, setCustomerName] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const [notified, setNotified] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = user?._id;

  const getServices = async () => {
    const res = await fetch(`http://localhost:5000/api/services/${barberId}`);
    const data = await res.json();
    setServices(data);
  };

  const getBookings = async () => {
    const res = await fetch("http://localhost:5000/api/bookings");
    const data = await res.json();

    const filtered = data.filter((b) => b.barberId === barberId);
    setBookings(filtered);
  };

  useEffect(() => {
    getServices();
    getBookings();
    setIsOpen(user?.isOpen);

    const interval = setInterval(() => {
      getBookings();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 🔔 Notification
  useEffect(() => {
    if (bookings.length === 0) return;

    const first = bookings[0];

    const waitTime = Math.floor(
      (new Date(first.startTime) - new Date()) / 60000
    );

    if (first._id !== notified) {
      if (waitTime <= 0) {
        alert(`🔔 ${first.customerName}, it's your turn!`);
        setNotified(first._id);
      } else if (waitTime <= 5) {
        alert(`⏱ ${first.customerName}, your turn in ${waitTime} min`);
        setNotified(first._id);
      }
    }
  }, [bookings]);

  const completeBooking = async (id) => {
    const res = await fetch(`http://localhost:5000/api/complete/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: barberId
      })
    });

    const data = await res.json();
    alert(data.message);

    getBookings();
  };

  const toggleShop = async () => {
    const res = await fetch(
      `http://localhost:5000/api/toggle-shop/${barberId}`,
      { method: "PUT" }
    );

    const data = await res.json();
    setIsOpen(data.isOpen);

    localStorage.setItem(
      "user",
      JSON.stringify({ ...user, isOpen: data.isOpen })
    );
  };

  const addService = async () => {
    if (!name || !duration || !price) {
      alert("Please fill all fields");
      return;
    }

    await fetch("http://localhost:5000/api/add-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        duration,
        price,
        barberId
      })
    });

    setName("");
    setDuration("");
    setPrice("");

    getServices();
  };

  const toggleService = (service) => {
    const exists = selectedServices.find((s) => s._id === service._id);

    if (exists) {
      setSelectedServices(
        selectedServices.filter((s) => s._id !== service._id)
      );
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const addOfflineBooking = async () => {
    if (!customerName || selectedServices.length === 0) {
      alert("Fill all fields");
      return;
    }

    const totalTime = selectedServices.reduce(
      (sum, s) => sum + s.duration,
      0
    );

    await fetch("http://localhost:5000/api/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        barberId,
        services: selectedServices.map((s) => s.name),
        totalTime,
        customerName,
        customerId: "offline-" + Date.now(),
        isOffline: true
      })
    });

    setCustomerName("");
    setSelectedServices([]);

    alert("Walk-in customer added ✅");

    getBookings();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Barber Dashboard 🧑‍🔧</h1>

      <button
        onClick={toggleShop}
        style={{
          background: isOpen ? "green" : "red",
          color: "white",
          padding: "10px",
          marginBottom: "20px"
        }}
      >
        {isOpen ? "🟢 Shop Open" : "🔴 Shop Closed"}
      </button>

      <h2>Add Service</h2>

      <input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
      <input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />

      <br /><br />
      <button onClick={addService}>Add Service</button>

      <h2>Your Services</h2>
      {services.map((s) => (
        <div key={s._id}>
          <p>{s.name} - {s.duration} min - ₹{s.price}</p>
        </div>
      ))}

      <h2>Add Walk-in Customer 🚶‍♂️</h2>

      <input
        placeholder="Customer Name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
      />

      <h3>Select Services</h3>

      {services.map((s) => (
        <div
          key={s._id}
          onClick={() => toggleService(s)}
          style={{
            border: "1px solid black",
            padding: "5px",
            margin: "5px",
            cursor: "pointer",
            background:
              selectedServices.find((x) => x._id === s._id)
                ? "#ddd"
                : "white"
          }}
        >
          {s.name} - {s.duration} min
        </div>
      ))}

      <p>Total Time: {selectedServices.reduce((sum, s) => sum + s.duration, 0)} min</p>

      <button onClick={addOfflineBooking}>Add to Queue</button>

      <h2>Current Queue 📋</h2>

      {bookings.length === 0 ? (
        <p>No customers in queue</p>
      ) : (
        bookings.map((b, index) => {

          const waitTime = Math.max(
            0,
            Math.floor((new Date(b.startTime) - new Date()) / 60000)
          );

          // ✅ FIXED REPEAT LOGIC
          const visitCount = bookings.filter(
            (x) =>
              (x.customerId && x.customerId === b.customerId) ||
              (!x.customerId && x.customerName === b.customerName)
          ).length;

          return (
            <div key={b._id} style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "8px",
              background: index === 0 ? "#d4edda" : "white"
            }}>
              <p>
                {index + 1}. {b.services.join(", ")} -{" "}
                {new Date(b.startTime).toLocaleTimeString()}
              </p>

              <p>👤 {b.customerName}</p>
              <p>🆔 {b.orderId}</p>

              <p>⏱ Waiting: {waitTime} min</p>

              {/* ✅ FIXED */}
              {visitCount > 1 && (
                <p style={{ color: "orange" }}>
                  🔁 Repeat Customer ({visitCount} bookings)
                </p>
              )}

              {b.isOffline && <p>🚶 Walk-in</p>}

              <button
                onClick={() => completeBooking(b._id)}
                style={{
                  background: "green",
                  color: "white",
                  padding: "5px",
                  marginTop: "5px"
                }}
              >
                ✅ Complete
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default BarberDashboard;