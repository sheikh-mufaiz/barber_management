import React, { useEffect, useState } from "react";
import ShopList from "./ShopList";
import QueueBoard from "./QueueBoard";

const API_URL = "http://localhost:5000/api";

function Booking() {
  const [services, setServices] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [message, setMessage] = useState("");
  const [bookings, setBookings] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [bookingType, setBookingType] = useState("instant");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedChairId, setSelectedChairId] = useState("");
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

  const selectedTotalTime = selectedServices.reduce((sum, service) => sum + service.duration, 0);
  const activeChairs = chairs.filter((chair) => chair.isActive);

  const bookDisabled =
    selectedServices.length === 0 ||
    (bookingType === "scheduled" && !scheduledFor) ||
    (bookingType === "scheduled" && !selectedChairId) ||
    Boolean(selectedServices.length && bookingEstimate?.available === false);

  const getServices = async () => {
    if (!barberId) return;

    try {
      const res = await fetch(`${API_URL}/services/${barberId}`);
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.error("GET SERVICES ERROR:", err);
      setServices([]);
      setMessage("Cannot reach server. Please make sure backend is running.");
    }
  };

  const getBookings = async () => {
    if (!barberId) return;

    try {
      const res = await fetch(`${API_URL}/bookings`);
      const data = await res.json();

      const filtered = data
        .filter((booking) => String(booking.barberId) === String(barberId))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      setBookings(filtered);
    } catch (err) {
      console.error("GET BOOKINGS ERROR:", err);
      setBookings([]);
      setMessage("Cannot reach server. Please make sure backend is running.");
    }
  };

  const getChairs = async () => {
    if (!barberId) return;

    try {
      const res = await fetch(`${API_URL}/chairs/${barberId}`);
      const data = await res.json();
      setChairs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("GET CHAIRS ERROR:", err);
      setChairs([]);
    }
  };

  useEffect(() => {
    setSelectedServices([]);
    setBookingEstimate(null);
    setMessage("");
    setSelectedChairId("");

    getServices();
    getBookings();
    getChairs();

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

        const res = await fetch(`${API_URL}/estimate-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            barberId,
            totalTime: selectedTotalTime,
            bookingType,
            scheduledFor: bookingType === "scheduled" ? scheduledFor : null,
            chairId: bookingType === "scheduled" ? selectedChairId : null
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
  }, [barberId, selectedServices, selectedTotalTime, bookingType, scheduledFor, selectedChairId]);

  const toggleService = (service) => {
    const exists = selectedServices.find((item) => item._id === service._id);

    if (exists) {
      setSelectedServices(selectedServices.filter((item) => item._id !== service._id));
      return;
    }

    setSelectedServices([...selectedServices, service]);
  };

  const handleBooking = async () => {
    if (selectedServices.length === 0) {
      setMessage("Please select at least one service");
      return;
    }

    if (bookingType === "scheduled" && !scheduledFor) {
      setMessage("Please select scheduled time");
      return;
    }

    if (bookingType === "scheduled" && !selectedChairId) {
      setMessage("Please select a chair");
      return;
    }

    const existing = bookings.find((booking) => booking.customerId === user._id);

    if (existing) {
      const confirmBooking = window.confirm(
        "You already have an active booking.\nDo you want to create another one?"
      );

      if (!confirmBooking) return;
    }

    const res = await fetch(`${API_URL}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        barberId,
        services: selectedServices.map((service) => service.name),
        totalTime: selectedTotalTime,
        customerName: user.name,
        customerId: user._id,
        bookingType,
        scheduledFor: bookingType === "scheduled" ? scheduledFor : null,
        chairId: bookingType === "scheduled" ? selectedChairId : null
      })
    });

    const data = await res.json();
    setMessage(data.message || data.error);

    if (!res.ok) return;

    setSelectedServices([]);
    setBookingType("instant");
    setScheduledFor("");
    setSelectedChairId("");
    setBookingEstimate(null);
    getBookings();
  };

  const cancelBooking = async (id) => {
    await fetch(`${API_URL}/cancel/${id}`, {
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
      <h1>Barber Booking App</h1>

      {!selectedBarber && <ShopList setSelectedBarber={setSelectedBarber} />}

      {selectedBarber && (
        <>
          <button onClick={() => setSelectedBarber(null)}>Change Shop</button>

          <h2>{selectedBarber.shopName}</h2>

          <h3>Select Services</h3>

          {services.map((service) => (
            <div
              key={service._id}
              onClick={() => toggleService(service)}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "8px",
                cursor: "pointer",
                background: selectedServices.find((item) => item._id === service._id)
                  ? "#ddd"
                  : "white"
              }}
            >
              <p>
                <b>{service.name}</b>
              </p>
              <p>{service.duration} min</p>
              <p>Rs {service.price}</p>
            </div>
          ))}

          <p>Total Time: {selectedTotalTime} min</p>

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
                    {new Date(bookingEstimate.estimatedStartTime).toLocaleTimeString()}
                  </p>
                  <p>Waiting: {bookingEstimate.waitMinutes || 0} min</p>
                  <p>Chair: {bookingEstimate.chairName || "Auto assigned"}</p>
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
            <>
              <input
                type="datetime-local"
                value={scheduledFor}
                min={getLocalDateTimeValue()}
                onChange={(e) => setScheduledFor(e.target.value)}
                style={{ display: "block", marginTop: "10px" }}
              />

              <select
                value={selectedChairId}
                onChange={(e) => setSelectedChairId(e.target.value)}
                style={{ display: "block", marginTop: "10px" }}
              >
                <option value="">Select Chair</option>
                {activeChairs.map((chair) => (
                  <option key={chair.id} value={chair.id}>
                    {chair.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {bookings.some((booking) => booking.customerId === user._id) && (
            <p style={{ color: "red" }}>You already have an active booking</p>
          )}

          <button
            onClick={handleBooking}
            disabled={bookDisabled}
            style={{ padding: "10px", marginTop: "10px" }}
          >
            Book Selected Services
          </button>

          <p>{message}</p>

          <QueueBoard chairs={chairs} bookings={bookings} title="Current Queue" />

          <h3>Your Active Bookings</h3>

          {bookings.filter((booking) => booking.customerId === user._id).length === 0 ? (
            <p>You do not have any active bookings.</p>
          ) : (
            bookings
              .filter((booking) => booking.customerId === user._id)
              .map((booking) => {
                const waitTime = getWaitTime(booking);

                return (
                  <div
                    key={booking._id}
                    style={{
                      border: "1px solid #ccc",
                      padding: "10px",
                      marginBottom: "10px",
                      borderRadius: "8px"
                    }}
                  >
                    <p>
                      {booking.services.join(", ")} -{" "}
                      {booking.actualStartTime
                        ? new Date(booking.actualStartTime).toLocaleTimeString()
                        : "Waiting"}
                    </p>

                    <p>{booking.customerName}</p>
                    <p>Order: {booking.orderId}</p>
                    <p>Chair: {booking.chairName || "Auto assigning"}</p>
                    <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>

                    {booking.bookingType === "scheduled" && (
                      <p>Scheduled: {new Date(booking.startTime).toLocaleString()}</p>
                    )}

                    {booking.status === "in-progress" ? (
                      <p style={{ color: "green" }}>In Progress ({waitTime} min left)</p>
                    ) : (
                      <p>Waiting: {waitTime} min</p>
                    )}

                    <button onClick={() => cancelBooking(booking._id)}>Cancel</button>
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
