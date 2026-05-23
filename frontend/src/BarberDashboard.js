import React, { useEffect, useState } from "react";
import QueueBoard from "./QueueBoard";

const API_URL = "http://localhost:5000/api";

function BarberDashboard() {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [services, setServices] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [walkInBookingType, setWalkInBookingType] = useState("instant");
  const [walkInScheduledFor, setWalkInScheduledFor] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = user?._id;
  const activeChairCount = chairs.filter((chair) => chair.isActive).length;

  useEffect(() => {
    document.title = "Barber Dashboard";
  }, []);

  const updateStoredUser = (updates) => {
    localStorage.setItem("user", JSON.stringify({ ...user, ...updates }));
  };

  const getServices = async () => {
    try {
      const res = await fetch(`${API_URL}/services/${barberId}`);
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const getChairs = async () => {
    try {
      const res = await fetch(`${API_URL}/chairs/${barberId}`);
      const data = await res.json();
      setChairs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setChairs([]);
    }
  };

  const getBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/bookings`);
      const data = await res.json();

      const filtered = data
        .filter((booking) => String(booking.barberId) === String(barberId))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      setBookings(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!barberId) return undefined;

    getServices();
    getBookings();
    getChairs();
    setIsOpen(Boolean(user?.isOpen));

    const interval = setInterval(getBookings, 1000);
    return () => clearInterval(interval);
  }, [barberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const calculateWait = (booking) => {
    const start = new Date(booking.startTime);
    if (isNaN(start.getTime())) return 0;

    return Math.max(0, Math.floor((start.getTime() - Date.now()) / 60000));
  };

  const getRemaining = (booking) => {
    if (booking.status === "in-progress" && booking.actualStartTime) {
      const elapsed = (Date.now() - new Date(booking.actualStartTime)) / 60000;
      return Math.max(0, Math.floor(booking.totalTime - elapsed));
    }

    return booking.totalTime || 0;
  };

  const startBooking = async (id) => {
    try {
      await fetch(`${API_URL}/start/${id}`, {
        method: "PUT"
      });

      await getBookings();
    } catch (err) {
      console.error("START ERROR:", err);
    }
  };

  const completeBooking = async (id) => {
    await fetch(`${API_URL}/complete/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: barberId })
    });

    getBookings();
  };

  const toggleShop = async () => {
    const res = await fetch(`${API_URL}/toggle-shop/${barberId}`, {
      method: "PUT"
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || "Could not update shop status");
    }

    setIsOpen(data.isOpen);
    updateStoredUser({ isOpen: data.isOpen });
  };

  const addService = async () => {
    const numericDuration = Number(duration);
    const numericPrice = Number(price);

    if (!name.trim()) {
      return alert("Service name is required");
    }

    if (isNaN(numericDuration) || numericDuration <= 0) {
      return alert("Duration must be a valid number");
    }

    if (price && isNaN(numericPrice)) {
      return alert("Price must be a number");
    }

    try {
      await fetch(`${API_URL}/add-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          duration: numericDuration,
          price: numericPrice,
          barberId
        })
      });

      setName("");
      setDuration("");
      setPrice("");
      getServices();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteService = async (id) => {
    try {
      await fetch(`${API_URL}/delete-service/${id}`, {
        method: "DELETE"
      });

      getServices();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleServiceSelection = (service) => {
    const exists = selectedServices.find((item) => item._id === service._id);

    if (exists) {
      setSelectedServices(selectedServices.filter((item) => item._id !== service._id));
      return;
    }

    setSelectedServices([...selectedServices, service]);
  };

  const addOfflineBooking = async () => {
    if (!customerName.trim() || selectedServices.length === 0) {
      return alert("Fill all walk-in details");
    }

    if (!activeChairCount) {
      return alert("Activate at least one chair before adding a booking");
    }

    if (walkInBookingType === "scheduled" && !walkInScheduledFor) {
      return alert("Select scheduled time");
    }

    const totalTime = selectedServices.reduce((sum, service) => sum + service.duration, 0);

    const res = await fetch(`${API_URL}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        barberId,
        services: selectedServices.map((service) => service.name),
        totalTime,
        customerName,
        customerId: `offline-${Date.now()}`,
        isOffline: true,
        bookingType: walkInBookingType,
        scheduledFor: walkInBookingType === "scheduled" ? walkInScheduledFor : null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || data.error || "Booking failed");
    }

    setCustomerName("");
    setSelectedServices([]);
    setWalkInBookingType("instant");
    setWalkInScheduledFor("");
    getBookings();
  };

  const addChair = () => {
    const nextNumber = chairs.length + 1;

    setChairs([
      ...chairs,
      {
        id: `chair-local-${Date.now()}`,
        name: `Chair ${nextNumber}`,
        isActive: true
      }
    ]);
  };

  const updateChair = (chairId, updates) => {
    setChairs(
      chairs.map((chair) => {
        if (chair.id !== chairId) {
          return chair;
        }

        return {
          ...chair,
          ...updates
        };
      })
    );
  };

  const saveChairs = async () => {
    const cleaned = chairs.map((chair) => ({
      ...chair,
      name: chair.name.trim()
    }));

    if (cleaned.some((chair) => !chair.name)) {
      return alert("Every chair needs a name");
    }

    if (isOpen && !cleaned.some((chair) => chair.isActive)) {
      return alert("Keep at least one chair active while the shop is open");
    }

    const res = await fetch(`${API_URL}/chairs/${barberId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chairs: cleaned
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || "Could not save chairs");
    }

    setChairs(data.chairs || []);
    updateStoredUser({ chairs: data.chairs || [] });
    getBookings();
  };

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Barber Dashboard</h1>

      <button
        onClick={toggleShop}
        style={{
          background: isOpen ? "red" : "green",
          color: "white",
          padding: "6px 12px",
          border: "none",
          marginBottom: "16px"
        }}
      >
        {isOpen ? "Close Shop" : "Open Shop"}
      </button>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px"
        }}
      >
        <h2>Manage Chairs</h2>
        <p>
          Active Chairs: <b>{activeChairCount}</b> / {chairs.length || 0}
        </p>

        {chairs.map((chair) => (
          <div
            key={chair.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
              flexWrap: "wrap"
            }}
          >
            <input
              value={chair.name}
              onChange={(e) => updateChair(chair.id, { name: e.target.value })}
              placeholder="Chair name"
            />

            <button onClick={() => updateChair(chair.id, { isActive: !chair.isActive })}>
              {chair.isActive ? "Turn Off" : "Turn On"}
            </button>

            <span style={{ color: chair.isActive ? "green" : "#666" }}>
              {chair.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ))}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={addChair}>Add Chair</button>
          <button onClick={saveChairs}>Save Chairs</button>
        </div>
      </div>

      <h2>Add Service</h2>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Service Name"
      />

      <input
        type="number"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="Duration (min)"
      />

      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
      />

      <button onClick={addService}>Add Service</button>

      <QueueBoard chairs={chairs} bookings={bookings} title="Per-Chair Live Queue" />

      {bookings.map((booking, index) => {
        const waitTime = calculateWait(booking);

        return (
          <div
            key={booking._id}
            style={{
              border: "1px solid #ccc",
              marginBottom: "10px",
              padding: "10px",
              background: booking.status === "in-progress" ? "#d4edda" : "white"
            }}
          >
            <h3>
              {index + 1}. {booking.customerName}
            </h3>
            <p>
              Services:
              {booking.services?.map((service, serviceIndex) => (
                <span
                  key={serviceIndex}
                  style={{
                    margin: "5px",
                    padding: "3px 6px",
                    background: "#eee",
                    borderRadius: "5px"
                  }}
                >
                  {service}
                </span>
              ))}
            </p>

            <p>
              Chair: <b>{booking.chairName || "Assigning..."}</b>
            </p>

            <p>
              Status:{" "}
              {booking.status === "in-progress"
                ? "In Progress"
                : waitTime === 0
                ? "Ready"
                : "Waiting"}
            </p>

            <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
            <p>Start: {new Date(booking.startTime).toLocaleTimeString()}</p>

            {booking.bookingType === "scheduled" && (
              <p>Scheduled: {new Date(booking.startTime).toLocaleString()}</p>
            )}

            <p>
              Actual Start:{" "}
              {booking.actualStartTime
                ? new Date(booking.actualStartTime).toLocaleTimeString()
                : "none"}
            </p>

            <p style={{ fontWeight: "bold" }}>
              {booking.status === "in-progress" ? (
                <span style={{ color: "green" }}>
                  In Progress ({getRemaining(booking)} min left)
                </span>
              ) : (
                <span>Waiting: {waitTime} min</span>
              )}
            </p>

            {booking.status !== "in-progress" && waitTime === 0 && (
              <button onClick={() => startBooking(booking._id)}>Start</button>
            )}

            {booking.status === "in-progress" && (
              <button onClick={() => completeBooking(booking._id)}>Complete</button>
            )}
          </div>
        );
      })}

      <h2>Add Walk-in</h2>

      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="Name"
      />

      <div style={{ marginTop: "10px" }}>
        <label style={{ marginRight: "10px" }}>
          <input
            type="radio"
            name="walkInBookingType"
            value="instant"
            checked={walkInBookingType === "instant"}
            onChange={() => setWalkInBookingType("instant")}
          />
          Instant
        </label>

        <label>
          <input
            type="radio"
            name="walkInBookingType"
            value="scheduled"
            checked={walkInBookingType === "scheduled"}
            onChange={() => setWalkInBookingType("scheduled")}
          />
          Schedule
        </label>
      </div>

      {walkInBookingType === "scheduled" && (
        <input
          type="datetime-local"
          value={walkInScheduledFor}
          min={getLocalDateTimeValue()}
          onChange={(e) => setWalkInScheduledFor(e.target.value)}
          style={{ display: "block", marginTop: "10px" }}
        />
      )}

      <div style={{ marginTop: "10px" }}>
        {services.map((service) => {
          const isSelected = selectedServices.find((item) => item._id === service._id);

          return (
            <div key={service._id} style={{ marginBottom: "5px" }}>
              <button onClick={() => toggleServiceSelection(service)}>
                {isSelected ? "Remove" : "Select"}
              </button>{" "}
              {service.name} ({service.duration} min, Rs {service.price || 0}){" "}
              <button onClick={() => deleteService(service._id)}>Delete</button>
            </div>
          );
        })}
      </div>

      <button onClick={addOfflineBooking}>Add to Queue</button>
    </div>
  );
}

export default BarberDashboard;
