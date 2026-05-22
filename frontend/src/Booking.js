import React, { useState, useEffect } from "react";
import ShopList from "./ShopList";

function Booking() {
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [message, setMessage] = useState("");
  const [bookings, setBookings] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [bookingType, setBookingType] = useState("instant");
  const [scheduledFor, setScheduledFor] = useState("");
  const [bookingEstimate, setBookingEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = selectedBarber?._id;

  const getLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const getWaitTime = (booking) => {
    if (booking.status === "in-progress" && booking.actualStartTime) {
      const elapsed = (Date.now() - new Date(booking.actualStartTime)) / 60000;
      return Math.max(0, Math.floor((booking.totalTime || 0) - elapsed));
    }

    const start = new Date(booking.startTime);
    if (isNaN(start.getTime())) return 0;

    return Math.max(0, Math.floor((start.getTime() - Date.now()) / 60000));
  };

  const selectedTotalTime = selectedServices.reduce(
    (sum, s) => sum + s.duration,
    0
  );

  const bookDisabled =
    selectedServices.length === 0 ||
    (bookingType === "scheduled" && !scheduledFor) ||
    (bookingType === "scheduled" && bookingEstimate?.available === false);

  // 🔥 Fetch services
  const getServices = async () => {
    if (!barberId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/services/${barberId}`);
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.error("GET SERVICES ERROR:", err);
      setServices([]);
      setMessage("Cannot reach server. Please make sure backend is running.");
    }
  };

  // 🔥 Fetch bookings
  const getBookings = async () => {
    if (!barberId) return;
    try {
      const res = await fetch("http://localhost:5000/api/bookings");
      const data = await res.json();

      const filtered = data
        .filter((b) => String(b.barberId) === String(barberId))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      setBookings(filtered);
    } catch (err) {
      console.error("GET BOOKINGS ERROR:", err);
      setBookings([]);
      setMessage("Cannot reach server. Please make sure backend is running.");
    }
  };

  useEffect(() => {
    setSelectedServices([]);
    setBookingEstimate(null);

    getServices();
    getBookings();

    const interval = setInterval(() => {
      getBookings();
    }, 2000);

    return () => clearInterval(interval);
  }, [barberId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!barberId || selectedServices.length === 0) {
      setBookingEstimate(null);
      return;
    }

    if (bookingType === "scheduled" && !scheduledFor) {
      setBookingEstimate(null);
      return;
    }

    let ignore = false;

    const getEstimate = async () => {
      try {
        setEstimateLoading(true);

        const res = await fetch("http://localhost:5000/api/estimate-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            barberId,
            totalTime: selectedTotalTime,
            bookingType,
            scheduledFor: bookingType === "scheduled" ? scheduledFor : null
          })
        });

        const data = await res.json();

        if (!ignore) {
          setBookingEstimate({
            ...data,
            available: res.ok && data.available !== false
          });
        }
      } catch (err) {
        if (!ignore) {
          setBookingEstimate({
            available: false,
            message: "Could not estimate start time"
          });
        }
      } finally {
        if (!ignore) setEstimateLoading(false);
      }
    };

    getEstimate();

    return () => {
      ignore = true;
    };
  }, [
    barberId,
    selectedServices,
    selectedTotalTime,
    bookingType,
    scheduledFor
  ]);

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

    if (bookingType === "scheduled" && !scheduledFor) {
      setMessage("Please select scheduled time");
      return;
    }

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
        totalTime: selectedTotalTime,
        customerName: user.name,
        customerId: user._id,
        bookingType,
        scheduledFor: bookingType === "scheduled" ? scheduledFor : null
      }),
    });

    const data = await res.json();
    setMessage(data.message || data.error);

    if (!res.ok) return;

    setSelectedServices([]);
    setBookingType("instant");
    setScheduledFor("");
    setBookingEstimate(null);
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
            Total Time: {selectedTotalTime} min
          </p>

          {selectedServices.length > 0 && (
            <div
              style={{
                border: "1px solid #ddd",
                padding: "10px",
                marginTop: "10px",
                borderRadius: "8px",
                background: "#f9f9f9"
              }}
            >
              {estimateLoading ? (
                <p>Checking expected start...</p>
              ) : bookingEstimate?.available ? (
                <>
                  <p>
                    Expected start:{" "}
                    {new Date(
                      bookingEstimate.estimatedStartTime
                    ).toLocaleTimeString()}
                  </p>
                  <p>Waiting: {bookingEstimate.waitMinutes || 0} min</p>
                </>
              ) : bookingEstimate?.message ? (
                <p style={{ color: "red" }}>{bookingEstimate.message}</p>
              ) : bookingType === "scheduled" && !scheduledFor ? (
                <p>Select scheduled time to see expected start</p>
              ) : null}
            </div>
          )}

          <div style={{ marginTop: "10px" }}>
            <label style={{ marginRight: "10px" }}>
              <input
                type="radio"
                name="bookingType"
                value="instant"
                checked={bookingType === "instant"}
                onChange={() => setBookingType("instant")}
              />
              Instant
            </label>

            <label>
              <input
                type="radio"
                name="bookingType"
                value="scheduled"
                checked={bookingType === "scheduled"}
                onChange={() => setBookingType("scheduled")}
              />
              Schedule
            </label>
          </div>

          {bookingType === "scheduled" && (
            <input
              type="datetime-local"
              value={scheduledFor}
              min={getLocalDateTimeValue()}
              onChange={(e) => setScheduledFor(e.target.value)}
              style={{ display: "block", marginTop: "10px" }}
            />
          )}

          {/* 🔥 WARNING UI */}
          {bookings.some(b => b.customerId === user._id) && (
            <p style={{ color: "red" }}>
              ⚠️ You already have an active booking
            </p>
          )}

          <button
            onClick={handleBooking}
            disabled={bookDisabled}
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

              const waitTime = getWaitTime(b);

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
                    {b.actualStartTime
  ? new Date(b.actualStartTime).toLocaleTimeString()
  : "Waiting"}
                  </p>

                  <p>👤 {b.customerName}</p>
                  <p>🆔 {b.orderId}</p>
                  <p>
                    Type:{" "}
                    {b.bookingType === "scheduled" ? "Scheduled" : "Instant"}
                  </p>
                  {b.bookingType === "scheduled" && (
                    <p>
                      Scheduled: {new Date(b.startTime).toLocaleString()}
                    </p>
                  )}

                  {index === 0 && b.actualStartTime ? (
  <p style={{ color: "green" }}>
    🟢 In Progress ({waitTime} min left)
  </p>
) : (
  <p>⏱ Waiting: {waitTime} min</p>
)}

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
