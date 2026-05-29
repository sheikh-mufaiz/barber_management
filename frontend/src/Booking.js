import React, { useEffect, useRef, useState } from "react";
import DashboardShell from "./DashboardShell";
import ShopList from "./ShopList";
import QueueBoard from "./QueueBoard";
import { useNotifications } from "./NotificationContext";
import {
  detectBookingNotifications,
  formatNotificationToken
} from "./bookingNotifications";
import { formatCurrency, getBadgeClassName, getDefaultProfile } from "./loyalty";
import {
  getBookingServiceItems,
  getBookingServiceNames,
  getBookingTotalPrice
} from "./bookingSnapshots";
import { filterHistoryBookings } from "./historyFilters";
import { apiFetch } from "./api";

const BOOKING_REFRESH_MS = 5000;

function Booking({ user: injectedUser, onLogout }) {
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
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const previousBookingsRef = useRef([]);
  const hasLoadedBookingsRef = useRef(false);
  const { notify } = useNotifications();

  const user = injectedUser || JSON.parse(localStorage.getItem("user"));
  const barberId = selectedBarber?._id;

  const getLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const getLocalDateValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
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
  const inProgressBookings = activeBookings.filter((booking) => booking.status === "in-progress");
  const activeCustomerBookings = customerBookings.filter(
    (booking) => booking.status === "booked" || booking.status === "in-progress"
  );
  const customerHistory = customerBookings.filter(
    (booking) => booking.status === "completed" || booking.status === "cancelled"
  );
  const filteredCustomerHistory = filterHistoryBookings(customerHistory, {
    searchQuery: historySearchQuery,
    statusFilter: historyStatusFilter,
    startDate: historyStartDate,
    endDate: historyEndDate,
    includeCustomerName: false
  });

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
      const res = await apiFetch(`/services/${barberId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load services");
      }
      setServices(data);
    } catch (err) {
      console.error("GET SERVICES ERROR:", err);
      setServices([]);
      setMessage(err.message || "Cannot reach server. Please make sure backend is running.");
    }
  };

  const getBookings = async () => {
    if (!barberId) return;

    try {
      const res = await apiFetch(`/bookings?barberId=${encodeURIComponent(barberId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load bookings");
      }

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
      setDashboardError(err.message || "Cannot refresh bookings.");
    }
  };

  const getChairs = async () => {
    if (!barberId) return;

    try {
      const res = await apiFetch(`/chairs/${barberId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load chairs");
      }
      setChairs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("GET CHAIRS ERROR:", err);
      setChairs([]);
      setDashboardError(err.message || "Could not load chairs.");
    }
  };

  const getCustomerProfileData = async () => {
    if (!barberId || !user?._id) {
      setCustomerProfile(getDefaultProfile());
      return;
    }

    try {
      setProfileLoading(true);
      const res = await apiFetch(`/customer-profile/${barberId}/${user._id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load profile");
      }
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
    }, BOOKING_REFRESH_MS);

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

        const res = await apiFetch(`/estimate-booking`, {
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

    const res = await apiFetch(`/book`, {
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
    try {
      const res = await apiFetch(`/cancel/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not cancel booking");
      }

      getBookings();
    } catch (err) {
      setDashboardError(err.message || "Could not cancel booking.");
    }
  };

  const customerSummaryCards = [
    {
      label: "Active Bookings",
      value: activeCustomerBookings.length,
      hint: selectedBarber ? "Current bookings with this shop" : "Select a shop to begin"
    },
    {
      label: "Selected Shop",
      value: selectedBarber ? `${activeChairs.length} active chairs` : "Not selected",
      hint: selectedBarber ? selectedBarber.shopName : "Browse barbers to get started"
    },
    {
      label: "Loyalty Badge",
      value: customerProfile.badge || "New",
      hint: profileLoading ? "Loading profile" : `${customerProfile.visitCount || 0} total visits`
    },
    {
      label: "Total Spend",
      value: formatCurrency(customerProfile.totalSpend || 0),
      hint: selectedBarber ? "Snapshot-backed booking totals" : "Appears after choosing a shop"
    }
  ];

  const customerShellActions = onLogout ? (
    <button className="dashboard-shell__action dashboard-shell__action--ghost" onClick={onLogout} type="button">
      Logout
    </button>
  ) : null;

  return (
    <DashboardShell
      theme="customer"
      eyebrow="Customer workspace"
      title="Booking Dashboard"
      description="Book services, track your queue, and review your visit history from one clean customer view."
      contextLabel={selectedBarber ? "Current shop" : "Signed in as"}
      contextValue={selectedBarber?.shopName || user?.name || "Customer"}
      actions={customerShellActions}
      navigation={selectedBarber ? customerSections : null}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      summaryCards={customerSummaryCards}
    >
      {dashboardError ? (
        <p className="form-feedback form-feedback--error">{dashboardError}</p>
      ) : null}

      {!selectedBarber && (
        <section className="dashboard-page-section customer-shop-discovery">
          <div className="customer-shop-discovery__intro">
            <div>
              <p className="customer-shop-discovery__eyebrow">Shop discovery</p>
              <h2>Choose a Shop</h2>
              <p>Select a barber to unlock booking, queue, history, and profile tools.</p>
            </div>

            <div className="customer-shop-discovery__status">
              <span>Ready to book</span>
              <strong>{activeCustomerBookings.length}</strong>
              <small>active bookings</small>
            </div>
          </div>

          <div className="dashboard-surface dashboard-surface--spacious customer-shop-discovery__surface">
            <ShopList setSelectedBarber={setSelectedBarber} />
          </div>
        </section>
      )}

      {selectedBarber && (
        <>
          <div className="dashboard-utility-bar">
            <button
              className="dashboard-shell__action dashboard-shell__action--secondary"
              onClick={() => {
                setSelectedBarber(null);
                setActiveSection("book");
              }}
              type="button"
            >
              Change Shop
            </button>
          </div>

          {activeSection === "book" && (
            <section className="dashboard-page-section customer-book-page">
              <div className="customer-book-page__intro">
                <div>
                  <p className="customer-shop-discovery__eyebrow">Book a visit</p>
                  <h3>Select Services</h3>
                  <p>Build your visit with richer service cards, then choose instant or scheduled booking.</p>
                </div>

                <div className="customer-book-page__quick-stats">
                  <article>
                    <span>Selected</span>
                    <strong>{selectedServices.length}</strong>
                  </article>
                  <article>
                    <span>Total time</span>
                    <strong>{selectedTotalTime} min</strong>
                  </article>
                  <article>
                    <span>Chairs</span>
                    <strong>{activeChairs.length}</strong>
                  </article>
                </div>
              </div>

              <div className="customer-book-layout">
                <div className="customer-service-picker">
                  <div className="service-card-grid customer-service-grid">
                    {services.map((service, index) => {
                      const isSelected = selectedServices.find((item) => item._id === service._id);

                      return (
                        <button
                          key={service._id}
                          className={`service-selection-card customer-service-card ${
                            isSelected ? "service-selection-card--selected customer-service-card--selected" : ""
                          }`}
                          onClick={() => toggleService(service)}
                          style={{ "--service-index": index }}
                          type="button"
                        >
                          <div className="service-selection-card__header">
                            <h4>{service.name}</h4>
                            <span className="service-selection-card__price">Rs {service.price}</span>
                          </div>
                          <p className="service-selection-card__meta">{service.duration} min service window</p>
                          <span className="service-selection-card__state">
                            {isSelected ? "Selected" : "Tap to select"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="editorial-panel editorial-panel--accent customer-book-summary">
                  <div className="editorial-panel__header">
                    <p className="customer-shop-discovery__eyebrow">Visit summary</p>
                    <h3>Booking Summary</h3>
                    <p>Total Time: {selectedTotalTime} min</p>
                  </div>

                  <div className="customer-book-summary__selection">
                    {selectedServices.length ? (
                      selectedServices.map((service) => (
                        <span key={service._id}>
                          {service.name} · {service.duration} min
                        </span>
                      ))
                    ) : (
                      <span>No services selected yet</span>
                    )}
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="booking-estimate-card customer-book-estimate">
                      {estimateLoading ? (
                        <p>Checking expected start...</p>
                      ) : bookingEstimate?.available ? (
                        <div className="booking-estimate-card__stats">
                          <p>Expected start: {new Date(bookingEstimate.estimatedStartTime).toLocaleTimeString()}</p>
                          <p>Waiting: {bookingEstimate.waitMinutes || 0} min</p>
                          <p>Chair: {bookingEstimate.chairName || "Auto assigned"}</p>
                        </div>
                      ) : bookingEstimate?.message ? (
                        <p className="form-feedback form-feedback--error">{bookingEstimate.message}</p>
                      ) : bookingType === "scheduled" && !scheduledFor ? (
                        <p>Select scheduled time to see expected start</p>
                      ) : null}
                    </div>
                  )}

                  <div className="choice-pills customer-book-mode">
                    <label className={`choice-pill ${bookingType === "instant" ? "choice-pill--active" : ""}`}>
                      <input
                        type="radio"
                        name="bookingType"
                        value="instant"
                        checked={bookingType === "instant"}
                        onChange={() => setBookingType("instant")}
                      />
                      Instant
                    </label>

                    <label className={`choice-pill ${bookingType === "scheduled" ? "choice-pill--active" : ""}`}>
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
                    <div className="form-grid customer-schedule-grid">
                      <label className="field-group">
                        <span>Scheduled For</span>
                        <input
                          className="app-field"
                          type="datetime-local"
                          value={scheduledFor}
                          min={getLocalDateTimeValue()}
                          onChange={(e) => setScheduledFor(e.target.value)}
                        />
                      </label>

                      <label className="field-group">
                        <span>Preferred Chair</span>
                        <select
                          className="app-field"
                          value={selectedChairId}
                          onChange={(e) => setSelectedChairId(e.target.value)}
                        >
                          <option value="">Select Chair</option>
                          {activeChairs.map((chair) => (
                            <option key={chair.id} value={chair.id}>
                              {chair.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  {activeCustomerBookings.length > 0 ? (
                    <p className="form-feedback form-feedback--error">You already have an active booking</p>
                  ) : null}

                  <div className="form-actions customer-book-actions">
                    <button className="app-button app-button--primary" onClick={handleBooking} disabled={bookDisabled}>
                      Book Selected Services
                    </button>
                    {message ? <p className="form-feedback">{message}</p> : null}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === "queue" && (
            <section className="dashboard-page-section customer-queue-page">
              <div className="customer-queue-page__intro">
                <div>
                  <p className="customer-shop-discovery__eyebrow">Live floor</p>
                  <h3>Queue Overview</h3>
                  <p>See how the chairs are moving before you head in, with a live shop-floor view.</p>
                </div>

                <div className="customer-queue-page__stats">
                  <article>
                    <span>Active chairs</span>
                    <strong>{activeChairs.length}</strong>
                  </article>
                  <article>
                    <span>In service</span>
                    <strong>{inProgressBookings.length}</strong>
                  </article>
                  <article>
                    <span>Waiting</span>
                    <strong>{Math.max(0, activeBookings.length - inProgressBookings.length)}</strong>
                  </article>
                </div>
              </div>

              <div className="customer-queue-page__board">
                <QueueBoard chairs={chairs} bookings={activeBookings} title="Current Queue" />
              </div>
            </section>
          )}

          {activeSection === "active" && (
            <section className="dashboard-page-section customer-active-page">
              <div className="customer-active-page__intro">
                <div>
                  <p className="customer-shop-discovery__eyebrow">Visit tracker</p>
                  <h3>Your Active Bookings</h3>
                  <p>Track your live slot, wait time, and chair details with a cleaner account view.</p>
                </div>

                <div className="customer-active-page__stats">
                  <article>
                    <span>Active</span>
                    <strong>{activeCustomerBookings.length}</strong>
                  </article>
                  <article>
                    <span>In progress</span>
                    <strong>
                      {activeCustomerBookings.filter((booking) => booking.status === "in-progress").length}
                    </strong>
                  </article>
                  <article>
                    <span>Waiting</span>
                    <strong>
                      {activeCustomerBookings.filter((booking) => booking.status === "booked").length}
                    </strong>
                  </article>
                </div>
              </div>

              {activeCustomerBookings.length === 0 ? (
                <div className="customer-active-empty">
                  <p className="customer-active-empty__eyebrow">No live visit</p>
                  <h4>You do not have any active bookings.</h4>
                  <p>Book a service to see your token, chair, wait time, and live status here.</p>
                </div>
              ) : (
                <div className="customer-active-list">
                  {activeCustomerBookings.map((booking, index) => {
                  const waitTime = getWaitTime(booking);
                  const isLive = booking.status === "in-progress";

                  return (
                    <div
                      key={booking._id}
                      className={`booking-activity-card customer-active-card ${
                        isLive ? "customer-active-card--live" : "customer-active-card--waiting"
                      }`}
                      style={{ "--active-index": index }}
                    >
                      <div className="customer-active-card__header">
                        <div>
                          <p className="customer-active-card__eyebrow">
                            {isLive ? "Now in chair" : "Waiting for chair"}
                          </p>
                          <p className="booking-activity-card__headline">
                            {booking.services.join(", ")} -{" "}
                            {booking.actualStartTime
                              ? new Date(booking.actualStartTime).toLocaleTimeString()
                              : "Waiting"}
                          </p>
                        </div>

                        <span className="customer-active-card__status">
                          {isLive ? `${waitTime} min left` : `${waitTime} min wait`}
                        </span>
                      </div>

                      <div className="customer-active-card__details">
                        <p>{booking.customerName}</p>
                        <p>Order: {booking.orderId}</p>
                        <p>Chair: {booking.chairName || "Auto assigning"}</p>
                        <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
                      </div>

                      {booking.bookingType === "scheduled" && (
                        <p className="customer-active-card__scheduled">
                          Scheduled: {new Date(booking.startTime).toLocaleString()}
                        </p>
                      )}

                      {booking.status === "in-progress" ? (
                        <p className="booking-activity-card__status booking-activity-card__status--live">
                          In Progress ({waitTime} min left)
                        </p>
                      ) : (
                        <p className="booking-activity-card__status">Waiting: {waitTime} min</p>
                      )}

                      <div className="customer-active-card__actions">
                        <button className="app-button app-button--secondary" onClick={() => cancelBooking(booking._id)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </section>
          )}

          {activeSection === "history" && (
            <section className="dashboard-page-section customer-history-page">
              <div className="customer-history-page__intro">
                <div>
                  <p className="customer-shop-discovery__eyebrow">Visit archive</p>
                  <h3>Order History</h3>
                  <p>Review completed and cancelled visits with accurate price snapshots and service details.</p>
                </div>

                <div className="customer-history-page__stats">
                  <article>
                    <span>Total</span>
                    <strong>{customerHistory.length}</strong>
                  </article>
                  <article>
                    <span>Completed</span>
                    <strong>{customerHistory.filter((booking) => booking.status === "completed").length}</strong>
                  </article>
                  <article>
                    <span>Cancelled</span>
                    <strong>{customerHistory.filter((booking) => booking.status === "cancelled").length}</strong>
                  </article>
                </div>
              </div>

              <div className="history-filter-bar customer-history-filters">
                <input
                  className="history-filter-input"
                  placeholder="Search by service or token"
                  aria-label="Customer history search"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />

                <select
                  className="history-filter-input"
                  aria-label="Customer history status"
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <input
                  className="history-filter-input"
                  type="date"
                  aria-label="Customer history start date"
                  max={historyEndDate || getLocalDateValue()}
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                />

                <input
                  className="history-filter-input"
                  type="date"
                  aria-label="Customer history end date"
                  min={historyStartDate || undefined}
                  max={getLocalDateValue()}
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                />
              </div>

              {customerHistory.length === 0 ? (
                <div className="customer-history-empty">
                  <p className="customer-active-empty__eyebrow">No archived visits</p>
                  <h4>No completed or cancelled orders yet.</h4>
                  <p>Your completed visits, cancellations, service snapshots, and totals will appear here.</p>
                </div>
              ) : filteredCustomerHistory.length === 0 ? (
                <div className="customer-history-empty">
                  <p className="customer-active-empty__eyebrow">No matches</p>
                  <h4>No history results match the current filters.</h4>
                  <p>Try a different service name, token, status, or date range.</p>
                </div>
              ) : (
                <div className="customer-history-list">
                  {filteredCustomerHistory.map((booking, index) => (
                    <div
                      key={booking._id}
                      className={`history-card customer-history-card customer-history-card--${booking.status}`}
                      style={{ "--history-index": index }}
                    >
                      <div className="customer-history-card__header">
                        <div>
                          <p className="customer-history-card__eyebrow">
                            {booking.status === "completed" ? "Completed visit" : "Cancelled visit"}
                          </p>
                          <p>
                            <b>{getBookingServiceNames(booking).join(", ")}</b>
                          </p>
                        </div>
                        <span className="customer-history-card__total">
                          {formatCurrency(getBookingTotalPrice(booking))}
                        </span>
                      </div>

                      <div className="customer-history-card__details">
                        <p>Order: {booking.orderId}</p>
                        <p>Chair: {booking.chairName || "Not assigned"}</p>
                        <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
                        <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                        <p>Total: {formatCurrency(getBookingTotalPrice(booking))}</p>
                      </div>

                      {Array.isArray(booking.serviceItems) && booking.serviceItems.length > 0 && (
                        <p className="customer-history-card__snapshot">
                          Snapshot:{" "}
                          {getBookingServiceItems(booking)
                            .map((item) => `${item.name} (${formatCurrency(item.price)})`)
                            .join(", ")}
                          </p>
                      )}
                      <p className="customer-history-card__date">{getHistoryLabel(booking)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "profile" && (
            <section className="dashboard-page-section customer-profile-page">
              <div className="customer-profile-page__intro">
                <div>
                  <p className="customer-shop-discovery__eyebrow">Loyalty profile</p>
                  <h3>Your Loyalty Profile</h3>
                  <p>See your spend, visits, favorite services, and recent loyalty activity in one premium account view.</p>
                </div>

                <div className="customer-profile-page__badge">
                  <span className={getBadgeClassName(customerProfile.badge)}>
                    {customerProfile.badge}
                  </span>
                  <strong>{customerProfile.visitCount || 0} visits</strong>
                  <small>{formatCurrency(customerProfile.totalSpend || 0)} total spend</small>
                </div>
              </div>

              {profileLoading ? (
                <div className="customer-history-empty">
                  <p className="customer-active-empty__eyebrow">Loading</p>
                  <h4>Loading your profile...</h4>
                  <p>We are refreshing your loyalty details for this shop.</p>
                </div>
              ) : (
                <>
                  <div className="loyalty-grid customer-profile-grid">
                    <article className="loyalty-card customer-profile-card">
                      <p className="loyalty-card__label">Badge</p>
                      <span className={getBadgeClassName(customerProfile.badge)}>
                        {customerProfile.badge}
                      </span>
                    </article>

                    <article className="loyalty-card customer-profile-card">
                      <p className="loyalty-card__label">Visit Count</p>
                      <strong className="loyalty-card__value">{customerProfile.visitCount}</strong>
                    </article>

                    <article className="loyalty-card customer-profile-card">
                      <p className="loyalty-card__label">Total Spend</p>
                      <strong className="loyalty-card__value">
                        {formatCurrency(customerProfile.totalSpend)}
                      </strong>
                    </article>

                    <article className="loyalty-card customer-profile-card">
                      <p className="loyalty-card__label">Favorite Service</p>
                      <strong className="loyalty-card__value">
                        {customerProfile.topService || "No visits yet"}
                      </strong>
                    </article>
                  </div>

                  <div className="analytics-panels customer-profile-panels">
                    <article className="analytics-panel customer-profile-panel">
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

                    <article className="analytics-panel customer-profile-panel">
                      <div className="analytics-panel__header">
                        <h3>Recent Loyalty History</h3>
                        <p>Your latest completed and cancelled bookings with this barber.</p>
                      </div>

                      {customerProfile.recentBookings?.length ? (
                        customerProfile.recentBookings.map((booking, index) => (
                          <div
                            key={booking._id}
                            className={`history-card customer-profile-recent-card customer-profile-recent-card--${booking.status}`}
                            style={{ "--recent-index": index }}
                          >
                            <div className="customer-profile-recent-card__header">
                              <p>
                                <b>{getBookingServiceNames(booking).join(", ")}</b>
                              </p>
                              <span>{booking.status === "completed" ? "Completed" : "Cancelled"}</span>
                            </div>
                            <div className="customer-profile-recent-card__details">
                              <p>Order: {booking.orderId}</p>
                              <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                              <p>Total: {formatCurrency(getBookingTotalPrice(booking))}</p>
                            </div>
                            {Array.isArray(booking.serviceItems) && booking.serviceItems.length > 0 && (
                              <p className="customer-history-card__snapshot">
                                Snapshot:{" "}
                                {getBookingServiceItems(booking)
                                  .map((item) => `${item.name} (${formatCurrency(item.price)})`)
                                  .join(", ")}
                              </p>
                            )}
                            <p className="customer-history-card__date">{getHistoryLabel(booking)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="customer-history-empty">
                          <p className="customer-active-empty__eyebrow">No recent visits</p>
                          <h4>Your completed and cancelled visits will appear here.</h4>
                          <p>Book and complete a visit to start building loyalty history.</p>
                        </div>
                      )}
                    </article>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default Booking;
