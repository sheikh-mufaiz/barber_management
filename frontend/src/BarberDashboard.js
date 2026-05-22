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
  const [walkInBookingType, setWalkInBookingType] = useState("instant");
  const [walkInScheduledFor, setWalkInScheduledFor] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = user?._id;

  useEffect(() => {
    document.title = "BARBER DASHBOARD UPDATED";
    console.log("BARBER_DASHBOARD_LOADED", { barberId });
    window.__BARBER_DASHBOARD_UPDATED = true;
  }, [barberId]);

  const getServices = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/services/${barberId}`);
      const data = await res.json();
      setServices(data);
    } catch (err) { console.error(err); }
  };

  const getBookings = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/bookings");
    const data = await res.json();

    const filtered = data
      .filter((b) => String(b.barberId) === String(barberId))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    console.log("FRESH BOOKINGS:", filtered); // 🔥 DEBUG

    setBookings(filtered);
  } catch (err) {
    console.error(err);
  }
};
  useEffect(() => {
    if (barberId) {
      getServices();
      getBookings();
      setIsOpen(user?.isOpen);

      const interval = setInterval(getBookings, 1000);
      return () => clearInterval(interval);
    }
  }, [barberId]);

  const getLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const calculateWait = (booking) => {
    const start = new Date(booking.startTime);
    if (isNaN(start.getTime())) return 0;

    return Math.max(0, Math.floor((start.getTime() - Date.now()) / 60000));
  };
  // ✅ REMAINING TIME FOR IN-PROGRESS
  const getRemaining = (booking) => {
    if (booking.status === "in-progress" && booking.actualStartTime) {
      const elapsed = (Date.now() - new Date(booking.actualStartTime)) / 60000;
      return Math.max(0, Math.floor(booking.totalTime - elapsed));
    }
    return booking.totalTime || 0;
  };
  // ✅ START BOOKING (NEW)
  const startBooking = async (id) => {
  try {
    const res = await fetch(`http://localhost:5000/api/start/${id}`, {
      method: "PUT",
    });

    const data = await res.json();
    console.log("START RESPONSE:", data);

    await getBookings(); // ✅ IMPORTANT

  } catch (err) {
    console.error("START ERROR:", err);
  }
};
  const completeBooking = async (id) => {
    await fetch(`http://localhost:5000/api/complete/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: barberId })
    });
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
  // 🔥 VALIDATION STARTS HERE

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

  // 🔥 VALIDATION ENDS HERE

  try {
    await fetch("http://localhost:5000/api/add-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        duration: numericDuration, // ✅ send number
        price: numericPrice,       // ✅ send number
        barberId,
      }),
    });

    // clear inputs
    setName("");
    setDuration("");
    setPrice("");

    getServices(); // refresh
  } catch (err) {
    console.error(err);
  }
};

  const deleteService = async (id) => {
  console.log("DELETE CLICKED:", id); // 🔥 ADD THIS

  try {
    await fetch(`http://localhost:5000/api/delete-service/${id}`, {
      method: "DELETE",
    });

    getServices();
  } catch (err) {
    console.error(err);
  }
};
  const toggleServiceSelection = (service) => {
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
      return alert("Fill fields");
    }

    if (walkInBookingType === "scheduled" && !walkInScheduledFor) {
      return alert("Select scheduled time");
    }

    const totalTime = selectedServices.reduce(
      (sum, s) => sum + s.duration,
      0
    );

    const res = await fetch("http://localhost:5000/api/book", {
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
        isOffline: true,
        bookingType: walkInBookingType,
        scheduledFor:
          walkInBookingType === "scheduled" ? walkInScheduledFor : null
      })
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.message || data.error || "Booking failed");
    }

    setCustomerName("");
    setSelectedServices([]);
    setWalkInBookingType("instant");
    setWalkInScheduledFor("");
    getBookings();
  };
return (
  <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>

    <h1>Barber Dashboard</h1>

    <button
  onClick={toggleShop}
  style={{
    background: isOpen ? "red" : "green",
    color: "white",
    padding: "5px 10px",
    border: "none",
    marginBottom: "10px"
  }}
>
  {isOpen ? "Close Shop" : "Open Shop"}
</button>
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

<button onClick={addService}>
  Add Service
</button>
    {/* ================= QUEUE ================= */}
    {bookings.map((b, index) => {
      const waitTime = calculateWait(b);

      return (
        <div
          key={b._id}
          style={{
            border: "1px solid #ccc",
            marginBottom: "10px",
            padding: "10px",
            background: index === 0 ? "#d4edda" : "white",
          }}
        >
          <h3>{index + 1}. {b.customerName}</h3>
          <p>
  Services:
  {b.services?.map((s, i) => (
    <span
      key={i}
      style={{
        margin: "5px",
        padding: "3px 6px",
        background: "#eee",
        borderRadius: "5px"
      }}
    >
      {s}
    </span>
  ))}
</p>
          <p>
            Status:{" "}
            {b.status === "in-progress"
              ? "🟢 In Progress"
              : index === 0
              ? "⏳ Ready"
              : "⌛ Waiting"}
          </p>

          <p>
            Type: {b.bookingType === "scheduled" ? "Scheduled" : "Instant"}
          </p>

          <p>Start: {new Date(b.startTime).toLocaleTimeString()}</p>

          {b.bookingType === "scheduled" && (
            <p>Scheduled: {new Date(b.startTime).toLocaleString()}</p>
          )}

          <p>
            Actual Start:{" "}
            {b.actualStartTime
              ? new Date(b.actualStartTime).toLocaleTimeString()
              : "none"}
          </p>

          <p style={{ fontWeight: "bold" }}>
            {b.status === "in-progress" ? (
              <span style={{ color: "green" }}>
                🟢 In Progress ({getRemaining(b)} min left)
              </span>
            ) : (
              <span>⏱ Waiting: {waitTime} min</span>
            )}
          </p>

          {index === 0 && b.status !== "in-progress" && (
            <button onClick={() => startBooking(b._id)}>
              ▶ Start
            </button>
          )}

          {b.status === "in-progress" && (
            <button onClick={() => completeBooking(b._id)}>
              ✅ Complete
            </button>
          )}
        </div>
      );
    })}

    {/* ================= WALK-IN ================= */}
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
      {services.map((s) => {
        const isSelected = selectedServices.find(
          (item) => item._id === s._id
        );

        return (
          <div key={s._id} style={{ marginBottom: "5px" }}>
            <button onClick={() => toggleServiceSelection(s)}>
              {isSelected ? "Remove" : "Select"}
            </button>{" "}
            {s.name} ({s.duration} min, Rs {s.price || 0}){" "}
            <button onClick={() => deleteService(s._id)}>Delete</button>
          </div>
        );
      })}
    </div>

    <button onClick={addOfflineBooking}>Add to Queue</button>
  </div>
);
}

export default BarberDashboard;
