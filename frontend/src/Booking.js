import React, { useEffect, useRef, useState } from "react";
import ShopList from "./ShopList";
import QueueBoard from "./QueueBoard";
import { useNotifications } from "./NotificationContext";
import {
  detectBookingNotifications,
  formatNotificationToken
} from "./bookingNotifications";
import { formatCurrency, getBadgeClassName, getDefaultProfile } from "./loyalty";

const API_URL = "http://localhost:5000/api";

function Booking() {
  const customerSections = [
    { id: "book", label: "Book" },
    { id: "queue", label: "Queue" },
    { id: "active", label: "Active" },
    { id: "history", label: "History" },
    { id: "profile", label: "Profile" }
  ];
  const [activeSection, setActiveSection] = useState("book");
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
  const [customerProfile, setCustomerProfile] = useState(getDefaultProfile());
  const [profileLoading, setProfileLoading] = useState(false);
  const previousBookingsRef = useRef([]);
  const hasLoadedBookingsRef = useRef(false);
  const { notify } = useNotifications();

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
  const customerBookings = bookings.filter((booking) => booking.customerId === user._id);
  const activeBookings = bookings.filter(
    (booking) => booking.status === "booked" || booking.status === "in-progress"
  );
  const activeCustomerBookings = customerBookings.filter(
    (booking) => booking.status === "booked" || booking.status === "in-progress"
  );
  const customerHistory = customerBookings.filter(
    (booking) => booking.status === "completed" || booking.status === "cancelled"
  );

  const getHistoryLabel = (booking) => {
    if (booking.status === "completed" && booking.completedAt) {
      return `Completed: ${new Date(booking.completedAt).toLocaleString()}`;
    }

    if (booking.status === "cancelled" && booking.cancelledAt) {
      return `Cancelled: ${new Date(booking.cancelledAt).toLocaleString()}`;
    }

    return `Updated: ${new Date(booking.updatedAt || booking.createdAt).toLocaleString()}`;
  };

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

      if (hasLoadedBookingsRef.current) {
        const notifications = detectBookingNotifications({
          previousBookings: previousBookingsRef.current,
          currentBookings: filtered,
          viewerRole: "customer",
          viewerUserId: user._id
        });

        notifications.forEach((notification) => notify(notification));
      } else {
        hasLoadedBookingsRef.current = true;
      }

      previousBookingsRef.current = filtered;
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

  const getCustomerProfileData = async () => {
    if (!barberId || !user?._id) {
      setCustomerProfile(getDefaultProfile());
      return;
    }

    try {
      setProfileLoading(true);
      const res = await fetch(`${API_URL}/customer-profile/${barberId}/${user._id}`);
      const data = await res.json();
      setCustomerProfile(
        data && typeof data === "object"
          ? {
              ...getDefaultProfile({
                barberId,
                customerId: user._id,
                customerName: user.name
              }),
              ...data
            }
          : getDefaultProfile({
              barberId,
              customerId: user._id,
              customerName: user.name
            })
      );
    } catch (err) {
      console.error("GET PROFILE ERROR:", err);
      setCustomerProfile(
        getDefaultProfile({
          barberId,
          customerId: user._id,
          customerName: user.name
        })
      );
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    setActiveSection("book");
    setSelectedServices([]);
    setBookingEstimate(null);
    setMessage("");
    setSelectedChairId("");
    setCustomerProfile(
      getDefaultProfile({
        barberId,
        customerId: user._id,
        customerName: user.name
      })
    );
    previousBookingsRef.current = [];
    hasLoadedBookingsRef.current = false;

    getServices();
    getBookings();
    getChairs();
    getCustomerProfileData();

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

    const existing = activeCustomerBookings.find((booking) => booking.customerId === user._id);

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

    notify({
      title: "Booking Confirmed",
      message: `${formatNotificationToken(data.booking?.orderId)} is confirmed for ${
        data.booking?.chairName || "the queue"
      }.`,
      variant: "success"
    });

    setSelectedServices([]);
    setBookingType("instant");
    setScheduledFor("");
    setSelectedChairId("");
    setBookingEstimate(null);
    getBookings();
    getCustomerProfileData();
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
          <button
            onClick={() => {
              setSelectedBarber(null);
              setActiveSection("book");
            }}
          >
            Change Shop
          </button>

          <h2>{selectedBarber.shopName}</h2>

          <div className="dashboard-nav" role="tablist" aria-label="Customer dashboard sections">
            {customerSections.map((section) => (
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

          {activeSection === "book" && (
            <section>
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

              {activeCustomerBookings.length > 0 && (
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
            </section>
          )}

          {activeSection === "queue" && (
            <section>
              <QueueBoard chairs={chairs} bookings={activeBookings} title="Current Queue" />
            </section>
          )}

          {activeSection === "active" && (
            <section>
              <h3>Your Active Bookings</h3>

              {activeCustomerBookings.length === 0 ? (
                <p>You do not have any active bookings.</p>
              ) : (
                activeCustomerBookings.map((booking) => {
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
            </section>
          )}

          {activeSection === "history" && (
            <section>
              <h3>Order History</h3>

              {customerHistory.length === 0 ? (
                <p>No completed or cancelled orders yet.</p>
              ) : (
                customerHistory
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.completedAt || b.cancelledAt || b.updatedAt || b.createdAt) -
                      new Date(a.completedAt || a.cancelledAt || a.updatedAt || a.createdAt)
                  )
                  .map((booking) => (
                    <div
                      key={booking._id}
                      className="history-card"
                    >
                      <p>
                        <b>{booking.services.join(", ")}</b>
                      </p>
                      <p>Order: {booking.orderId}</p>
                      <p>Chair: {booking.chairName || "Not assigned"}</p>
                      <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
                      <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                      <p>{getHistoryLabel(booking)}</p>
                    </div>
                  ))
              )}
            </section>
          )}

          {activeSection === "profile" && (
            <section>
              <h3>Your Loyalty Profile</h3>

              {profileLoading ? (
                <p>Loading your profile...</p>
              ) : (
                <>
                  <div className="loyalty-grid">
                    <article className="loyalty-card">
                      <p className="loyalty-card__label">Badge</p>
                      <span className={getBadgeClassName(customerProfile.badge)}>
                        {customerProfile.badge}
                      </span>
                    </article>

                    <article className="loyalty-card">
                      <p className="loyalty-card__label">Visit Count</p>
                      <strong className="loyalty-card__value">{customerProfile.visitCount}</strong>
                    </article>

                    <article className="loyalty-card">
                      <p className="loyalty-card__label">Total Spend</p>
                      <strong className="loyalty-card__value">
                        {formatCurrency(customerProfile.totalSpend)}
                      </strong>
                    </article>

                    <article className="loyalty-card">
                      <p className="loyalty-card__label">Favorite Service</p>
                      <strong className="loyalty-card__value">
                        {customerProfile.topService || "No visits yet"}
                      </strong>
                    </article>
                  </div>

                  <div className="analytics-panels">
                    <article className="analytics-panel">
                      <div className="analytics-panel__header">
                        <h3>Favorite Services</h3>
                        <p>Your most-booked services with this barber.</p>
                      </div>

                      {customerProfile.favoriteServices?.length ? (
                        <div className="analytics-bars">
                          {customerProfile.favoriteServices.map((service) => (
                            <div className="analytics-bar-row" key={service.name}>
                              <div className="analytics-bar-row__text">
                                <span>{service.name}</span>
                                <strong>{service.count} visits</strong>
                              </div>
                              <div className="analytics-bar-track">
                                <div
                                  className="analytics-bar-fill"
                                  style={{
                                    width: `${Math.max(
                                      18,
                                      (service.count / customerProfile.favoriteServices[0].count) * 100
                                    )}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No completed visits with this barber yet.</p>
                      )}
                    </article>

                    <article className="analytics-panel">
                      <div className="analytics-panel__header">
                        <h3>Recent Loyalty History</h3>
                        <p>Your latest completed and cancelled bookings with this barber.</p>
                      </div>

                      {customerProfile.recentBookings?.length ? (
                        customerProfile.recentBookings.map((booking) => (
                          <div key={booking._id} className="history-card">
                            <p>
                              <b>{(booking.services || []).join(", ")}</b>
                            </p>
                            <p>Order: {booking.orderId}</p>
                            <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                            <p>Total: {formatCurrency(booking.totalPrice)}</p>
                            <p>{getHistoryLabel(booking)}</p>
                          </div>
                        ))
                      ) : (
                        <p>Your completed and cancelled visits will appear here.</p>
                      )}
                    </article>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Booking;
