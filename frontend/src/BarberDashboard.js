import React, { useEffect, useRef, useState } from "react";
import QueueBoard from "./QueueBoard";
import { useNotifications } from "./NotificationContext";
import { detectBookingNotifications } from "./bookingNotifications";
import { formatCurrency, getBadgeClassName, getDefaultProfile } from "./loyalty";

const API_URL = "http://localhost:5000/api";

function BarberDashboard() {
  const [activeSection, setActiveSection] = useState("queue");
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
  const [customerProfiles, setCustomerProfiles] = useState({});
  const previousBookingsRef = useRef([]);
  const hasLoadedBookingsRef = useRef(false);
  const { notify } = useNotifications();

  const user = JSON.parse(localStorage.getItem("user"));
  const barberId = user?._id;
  const activeChairCount = chairs.filter((chair) => chair.isActive).length;
  const activeBookings = bookings.filter(
    (booking) => booking.status === "booked" || booking.status === "in-progress"
  );
  const bookingHistory = bookings.filter(
    (booking) => booking.status === "completed" || booking.status === "cancelled"
  );
  const analyticsBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const dashboardSections = [
    { id: "queue", label: "Queue" },
    { id: "analytics", label: "Analytics" },
    { id: "history", label: "History" },
    { id: "chairs", label: "Chairs" },
    { id: "services", label: "Services" },
    { id: "walkins", label: "Walk-ins" }
  ];

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

      if (hasLoadedBookingsRef.current) {
        const notifications = detectBookingNotifications({
          previousBookings: previousBookingsRef.current,
          currentBookings: filtered,
          viewerRole: "barber",
          viewerUserId: barberId
        });

        notifications.forEach((notification) => notify(notification));
      } else {
        hasLoadedBookingsRef.current = true;
      }

      previousBookingsRef.current = filtered;
      setBookings(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const getCustomerProfiles = async () => {
    try {
      const res = await fetch(`${API_URL}/customer-profiles/${barberId}`);
      const data = await res.json();

      setCustomerProfiles(
        Array.isArray(data)
          ? data.reduce((map, profile) => {
              map[profile.customerId] = profile;
              return map;
            }, {})
          : {}
      );
    } catch (err) {
      console.error(err);
      setCustomerProfiles({});
    }
  };

  useEffect(() => {
    if (!barberId) return undefined;

    getServices();
    getBookings();
    getChairs();
    getCustomerProfiles();
    setIsOpen(Boolean(user?.isOpen));
    previousBookingsRef.current = [];
    hasLoadedBookingsRef.current = false;

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

  const getHistoryDate = (booking) => {
    if (booking.status === "completed" && booking.completedAt) {
      return `Completed: ${new Date(booking.completedAt).toLocaleString()}`;
    }

    if (booking.status === "cancelled" && booking.cancelledAt) {
      return `Cancelled: ${new Date(booking.cancelledAt).toLocaleString()}`;
    }

    return `Updated: ${new Date(booking.updatedAt || booking.createdAt).toLocaleString()}`;
  };

  const servicePriceMap = services.reduce((map, service) => {
    map[service.name] = Number(service.price || 0);
    return map;
  }, {});

  const totalBookings = analyticsBookings.length;
  const estimatedRevenue = analyticsBookings.reduce((sum, booking) => {
    const bookingRevenue =
      typeof booking.totalPrice === "number"
        ? Number(booking.totalPrice || 0)
        : (booking.services || []).reduce(
            (serviceSum, serviceName) => serviceSum + (servicePriceMap[serviceName] || 0),
            0
          );

    return sum + bookingRevenue;
  }, 0);

  const servicePopularity = Object.entries(
    analyticsBookings.reduce((counts, booking) => {
      (booking.services || []).forEach((serviceName) => {
        counts[serviceName] = (counts[serviceName] || 0) + 1;
      });

      return counts;
    }, {})
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const peakBookingHours = Object.entries(
    analyticsBookings.reduce((counts, booking) => {
      const start = booking.startTime ? new Date(booking.startTime) : null;

      if (!start || isNaN(start.getTime())) {
        return counts;
      }

      const hour = start.getHours();
      const label = `${String(hour).padStart(2, "0")}:00`;
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {})
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topServiceCount = servicePopularity[0]?.[1] || 0;
  const topHourCount = peakBookingHours[0]?.[1] || 0;
  const getProfileForBooking = (booking) =>
    customerProfiles[booking.customerId] ||
    getDefaultProfile({
      barberId,
      customerId: booking.customerId,
      customerName: booking.customerName
    });

  const startBooking = async (id) => {
    try {
      await fetch(`${API_URL}/start/${id}`, {
        method: "PUT"
      });

      await getBookings();
      await getCustomerProfiles();
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
    getCustomerProfiles();
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
    getCustomerProfiles();
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
    getCustomerProfiles();
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

      <div className="dashboard-nav" role="tablist" aria-label="Barber dashboard sections">
        {dashboardSections.map((section) => (
          <button
            key={section.id}
            className={`dashboard-nav__button ${
              activeSection === section.id ? "dashboard-nav__button--active" : ""
            }`}
            onClick={() => setActiveSection(section.id)}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "chairs" && (
        <section>
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
        </section>
      )}

      {activeSection === "services" && (
        <section>
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

          <div style={{ marginTop: "10px" }}>
            {services.map((service) => (
              <div key={service._id} style={{ marginBottom: "5px" }}>
                {service.name} ({service.duration} min, Rs {service.price || 0}){" "}
                <button onClick={() => deleteService(service._id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "queue" && (
        <section>
          <QueueBoard chairs={chairs} bookings={activeBookings} title="Per-Chair Live Queue" />

          {activeBookings.length === 0 ? (
            <p>No active bookings right now.</p>
          ) : (
            activeBookings.map((booking, index) => {
              const waitTime = calculateWait(booking);
              const loyaltyProfile = getProfileForBooking(booking);

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
                  <div className="loyalty-summary">
                    <span className={getBadgeClassName(loyaltyProfile.badge)}>
                      {loyaltyProfile.badge}
                    </span>
                    <span className="loyalty-summary__meta">{loyaltyProfile.visitCount} visits</span>
                    <span className="loyalty-summary__meta">
                      {formatCurrency(loyaltyProfile.totalSpend)}
                    </span>
                    <span className="loyalty-summary__meta">
                      Favorite: {loyaltyProfile.topService || "No repeat data yet"}
                    </span>
                  </div>

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
            })
          )}
        </section>
      )}

      {activeSection === "analytics" && (
        <section>
          <h2>Analytics Dashboard</h2>

          <div className="analytics-grid">
            <article className="analytics-card">
              <p className="analytics-card__label">Total Bookings</p>
              <strong className="analytics-card__value">{totalBookings}</strong>
              <span className="analytics-card__hint">Active + completed bookings</span>
            </article>

            <article className="analytics-card">
              <p className="analytics-card__label">Estimated Revenue</p>
              <strong className="analytics-card__value">Rs {estimatedRevenue}</strong>
              <span className="analytics-card__hint">Based on current service prices</span>
            </article>
          </div>

          <div className="analytics-panels">
            <article className="analytics-panel">
              <div className="analytics-panel__header">
                <h3>Most Popular Service</h3>
                <p>Service demand ranked by completed and active bookings.</p>
              </div>

              {servicePopularity.length === 0 ? (
                <p>No service data yet.</p>
              ) : (
                <div className="analytics-bars">
                  {servicePopularity.map(([serviceName, count]) => (
                    <div className="analytics-bar-row" key={serviceName}>
                      <div className="analytics-bar-row__text">
                        <span>{serviceName}</span>
                        <strong>{count} bookings</strong>
                      </div>
                      <div className="analytics-bar-track">
                        <div
                          className="analytics-bar-fill"
                          style={{
                            width: `${Math.max(18, (count / topServiceCount) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel__header">
                <h3>Peak Booking Hours</h3>
                <p>Most active booking windows from saved start times.</p>
              </div>

              {peakBookingHours.length === 0 ? (
                <p>No booking hours yet.</p>
              ) : (
                <div className="analytics-bars">
                  {peakBookingHours.map(([hourLabel, count]) => (
                    <div className="analytics-bar-row" key={hourLabel}>
                      <div className="analytics-bar-row__text">
                        <span>{hourLabel}</span>
                        <strong>{count} bookings</strong>
                      </div>
                      <div className="analytics-bar-track">
                        <div
                          className="analytics-bar-fill analytics-bar-fill--accent"
                          style={{
                            width: `${Math.max(18, (count / topHourCount) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      )}

      {activeSection === "history" && (
        <section>
          <h2>Order History</h2>

          {bookingHistory.length === 0 ? (
            <p>No completed or cancelled orders yet.</p>
          ) : (
            bookingHistory
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.completedAt || b.cancelledAt || b.updatedAt || b.createdAt) -
                  new Date(a.completedAt || a.cancelledAt || a.updatedAt || a.createdAt)
              )
              .map((booking) => (
                <div key={booking._id} className="history-card">
                  <div className="loyalty-summary">
                    <span className={getBadgeClassName(getProfileForBooking(booking).badge)}>
                      {getProfileForBooking(booking).badge}
                    </span>
                    <span className="loyalty-summary__meta">
                      {getProfileForBooking(booking).visitCount} visits
                    </span>
                    <span className="loyalty-summary__meta">
                      {formatCurrency(getProfileForBooking(booking).totalSpend)}
                    </span>
                  </div>
                  <h3>{booking.customerName}</h3>
                  <p>Services: {booking.services?.join(", ")}</p>
                  <p>Order: {booking.orderId}</p>
                  <p>Chair: {booking.chairName || "Not assigned"}</p>
                  <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
                  <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                  <p>
                    Favorite Service: {getProfileForBooking(booking).topService || "No repeat data yet"}
                  </p>
                  <p>{getHistoryDate(booking)}</p>
                </div>
              ))
          )}
        </section>
      )}

      {activeSection === "walkins" && (
        <section>
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
                  {service.name} ({service.duration} min, Rs {service.price || 0})
                </div>
              );
            })}
          </div>

          <button onClick={addOfflineBooking}>Add to Queue</button>
        </section>
      )}
    </div>
  );
}

export default BarberDashboard;
