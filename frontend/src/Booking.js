import React, { useState, useEffect } from "react";
import ShopList from "./ShopList";

function Booking() {
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [message, setMessage] = useState("");
  const [bookings, setBookings] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = selectedBarber?._id;

  // 🔥 Fetch services
  const getServices = async () => {
    if (!barberId) return;

    const res = await fetch(`http://localhost:5000/api/services/${barberId}`);
    const data = await res.json();
    setServices(data);
  };

  // 🔥 Fetch bookings
  const getBookings = async () => {
    if (!barberId) return;

    const res = await fetch("http://localhost:5000/api/bookings");
    const data = await res.json();

    const filtered = data.filter((b) => b.barberId === barberId);
    setBookings(filtered);
  };

  useEffect(() => {
    setSelectedServices([]);

    getServices();
    getBookings();

    const interval = setInterval(() => {
      getBookings();
    }, 2000);

    return () => clearInterval(interval);
  }, [barberId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔥 Toggle services
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

  // 🔥 Book service
  const handleBooking = async () => {
    if (selectedServices.length === 0) {
      setMessage("Please select at least one service");
      return;
    }

    const totalTime = selectedServices.reduce(
      (sum, s) => sum + s.duration,
      0
    );

    // ✅ FIXED DUPLICATE CHECK (only by customerId)
    const existing = bookings.find(b => b.customerId === user._id);

    if (existing) {
      const confirmBooking = window.confirm(
        "⚠️ You already have an active booking.\nDo you want to create another one?"
      );
      if (!confirmBooking) return;
    }

    const res = await fetch("http://localhost:5000/api/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barberId,
        services: selectedServices.map((s) => s.name),
        totalTime,
        customerName: user.name,
        customerId: user._id
      }),
    });

    const data = await res.json();
    setMessage(data.message);

    setSelectedServices([]);
    getBookings();
  };

  // 🔥 Cancel booking
  const cancelBooking = async (id) => {
    await fetch(`http://localhost:5000/api/cancel/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: user._id,
        role: user.role
      })
    });

    getBookings();
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Barber Booking App ✂️</h1>

      {!selectedBarber && (
        <ShopList setSelectedBarber={setSelectedBarber} />
      )}

      {selectedBarber && (
        <>
          <button onClick={() => setSelectedBarber(null)}>
            🔙 Change Shop
          </button>

          <h2>{selectedBarber.shopName}</h2>

          <h3>Select Services</h3>

          {services.map((s) => (
            <div
              key={s._id}
              onClick={() => toggleService(s)}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "8px",
                cursor: "pointer",
                background: selectedServices.find(
                  (x) => x._id === s._id
                )
                  ? "#ddd"
                  : "white",
              }}
            >
              <p><b>{s.name}</b></p>
              <p>⏱ {s.duration} min</p>
              <p>₹ {s.price}</p>
            </div>
          ))}

          <p>
            Total Time:{" "}
            {selectedServices.reduce((sum, s) => sum + s.duration, 0)} min
          </p>

          {/* 🔥 WARNING UI */}
          {bookings.some(b => b.customerId === user._id) && (
            <p style={{ color: "red" }}>
              ⚠️ You already have an active booking
            </p>
          )}

          <button
            onClick={handleBooking}
            disabled={selectedServices.length === 0}
            style={{ padding: "10px", marginTop: "10px" }}
          >
            Book Selected Services
          </button>

          <p>{message}</p>

          <h3>Current Queue</h3>

          {bookings.length === 0 ? (
            <p>No bookings yet</p>
          ) : (
            bookings.map((b, index) => {

              const waitTime = Math.max(
                0,
                Math.floor(
                  (new Date(b.startTime) - new Date()) / 60000
                )
              );

              // ✅ Repeat logic (only by customerId)
              const visitCount = bookings.filter(
                (x) => x.customerId === b.customerId
              ).length;

              return (
                <div
                  key={b._id}
                  style={{
                    border: "1px solid #ccc",
                    padding: "10px",
                    marginBottom: "10px",
                    borderRadius: "8px"
                  }}
                >
                  <p>
                    {index + 1}. {b.services.join(", ")} -{" "}
                    {new Date(b.startTime).toLocaleTimeString()}
                  </p>

                  <p>👤 {b.customerName}</p>
                  <p>🆔 {b.orderId}</p>

                  <p>⏱ Waiting: {waitTime} min</p>

                  {visitCount > 1 && (
                    <p style={{ color: "orange" }}>
                      🔁 Repeat ({visitCount})
                    </p>
                  )}

                  {/* ✅ FIXED CANCEL */}
                  {b.customerId === user._id && (
                    <button onClick={() => cancelBooking(b._id)}>
                      Cancel
                    </button>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

export default Booking;