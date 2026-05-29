import React, { useEffect, useRef, useState } from "react";
import DashboardShell from "./DashboardShell";
import QueueBoard from "./QueueBoard";
import { useNotifications } from "./NotificationContext";
import { detectBookingNotifications } from "./bookingNotifications";
import { formatCurrency, getBadgeClassName, getDefaultProfile } from "./loyalty";
import {
  getBookingServiceItems,
  getBookingServiceNames,
  getBookingTotalPrice
} from "./bookingSnapshots";
import { filterHistoryBookings } from "./historyFilters";
import { apiFetch } from "./api";

const BOOKING_REFRESH_MS = 5000;

function BarberDashboard({ user: injectedUser, onLogout }) {
  const analyticsPresets = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "custom", label: "Custom Range" }
  ];
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
  const [walkInEstimate, setWalkInEstimate] = useState(null);
  const [walkInEstimateLoading, setWalkInEstimateLoading] = useState(false);
  const [analyticsPreset, setAnalyticsPreset] = useState("today");
  const [analyticsScope, setAnalyticsScope] = useState("overall");
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState("");
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [expandedChairRevenueIds, setExpandedChairRevenueIds] = useState([]);
  const [chairRevenueView, setChairRevenueView] = useState("overview");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [customerProfiles, setCustomerProfiles] = useState({});
  const [chairSaveState, setChairSaveState] = useState("saved");
  const [dashboardError, setDashboardError] = useState("");
  const previousBookingsRef = useRef([]);
  const hasLoadedBookingsRef = useRef(false);
  const { notify } = useNotifications();

  const user = injectedUser || JSON.parse(localStorage.getItem("user"));
  const barberId = user?._id;
  const activeChairCount = chairs.filter((chair) => chair.isActive).length;
  const activeBookings = bookings.filter(
    (booking) => booking.status === "booked" || booking.status === "in-progress"
  );
  const inProgressBookings = activeBookings.filter((booking) => booking.status === "in-progress");
  const readyBookings = activeBookings.filter((booking) => {
    const start = new Date(booking.startTime);
    return booking.status === "booked" && !isNaN(start.getTime()) && start.getTime() <= Date.now();
  });
  const bookingHistory = bookings.filter(
    (booking) => booking.status === "completed" || booking.status === "cancelled"
  );
  const dashboardSections = [
    { id: "queue", label: "Queue" },
    { id: "analytics", label: "Analytics" },
    { id: "history", label: "History" },
    { id: "chairs", label: "Chairs" },
    { id: "chairRevenue", label: "Chair Revenue" },
    { id: "services", label: "Services" },
    { id: "walkins", label: "Walk-ins" }
  ];
  const historyCount = bookingHistory.length;

  useEffect(() => {
    document.title = "Barber Dashboard";
  }, []);

  const updateStoredUser = (updates) => {
    localStorage.setItem("user", JSON.stringify({ ...user, ...updates }));
  };

  const getServices = async () => {
    try {
      const res = await apiFetch(`/services/${barberId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load services");
      }
      setServices(data);
    } catch (err) {
      console.error(err);
      setDashboardError(err.message || "Could not load services.");
    }
  };

  const getChairs = async () => {
    try {
      const res = await apiFetch(`/chairs/${barberId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load chairs");
      }
      setChairs(Array.isArray(data) ? data : []);
      setChairSaveState("saved");
    } catch (err) {
      console.error(err);
      setChairs([]);
      setChairSaveState("error");
      setDashboardError(err.message || "Could not load chairs.");
    }
  };

  const getBookings = async () => {
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
      setDashboardError(err.message || "Could not refresh bookings.");
    }
  };

  const getCustomerProfiles = async () => {
    try {
      const res = await apiFetch(`/customer-profiles/${barberId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not load customer profiles");
      }

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
      setDashboardError(err.message || "Could not load customer profiles.");
    }
  };

  const loadAnalyticsOverview = async () => {
    if (!barberId) {
      return false;
    }

    const range = getAnalyticsRange(analyticsPreset);

    if (analyticsPreset === "custom" && !range) {
      setAnalyticsData(null);
      setAnalyticsError("");
      setAnalyticsLoading(false);
      return false;
    }

    try {
      setAnalyticsLoading(true);
      setAnalyticsError("");

      const params = new URLSearchParams({
        barberId,
        rangePreset: analyticsPreset
      });

      if (range) {
        params.set("startDate", range.start);
        params.set("endDate", range.end);
      }

      const res = await apiFetch(`/analytics/overview?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load analytics");
      }

      setAnalyticsData(data);
      return true;
    } catch (err) {
      setAnalyticsData(null);
      setAnalyticsError(err.message || "Could not load analytics");
      return false;
    } finally {
      setAnalyticsLoading(false);
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

    const interval = setInterval(getBookings, BOOKING_REFRESH_MS);
    return () => clearInterval(interval);
  }, [barberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const getLocalDateValue = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const getAnalyticsRange = (preset) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (preset === "week") {
      const day = start.getDay();
      const diffToMonday = (day + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
    } else if (preset === "month") {
      start.setDate(1);
    } else if (preset === "custom") {
      if (!analyticsCustomStart || !analyticsCustomEnd) {
        return null;
      }

      const customStart = new Date(analyticsCustomStart);
      const customEnd = new Date(analyticsCustomEnd);

      if (Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime())) {
        return null;
      }

      customStart.setHours(0, 0, 0, 0);
      customEnd.setHours(23, 59, 59, 999);

      return {
        start: customStart.toISOString(),
        end: customEnd.toISOString()
      };
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  const formatPercentage = (value) => `${Number(value || 0).toFixed(1)}%`;
  const formatMinutes = (value) => `${Math.round(Number(value || 0))} min`;
  const formatTransactionTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Time unavailable"
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const toggleChairRevenueHistory = (chairId) => {
    setExpandedChairRevenueIds((current) =>
      current.includes(chairId)
        ? current.filter((id) => id !== chairId)
        : [...current, chairId]
    );
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
  const getProfileForBooking = (booking) =>
    customerProfiles[booking.customerId] ||
    getDefaultProfile({
      barberId,
      customerId: booking.customerId,
      customerName: booking.customerName
    });

  useEffect(() => {
    if (!barberId) {
      return;
    }

    loadAnalyticsOverview().catch(() => {});
  }, [analyticsCustomEnd, analyticsCustomStart, analyticsPreset, barberId]);

  const startBooking = async (id) => {
    try {
      const res = await apiFetch(`/start/${id}`, {
        method: "PUT"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not start booking");
      }

      await getBookings();
      await getCustomerProfiles();
    } catch (err) {
      console.error("START ERROR:", err);
      setDashboardError(err.message || "Could not start booking.");
    }
  };

  const completeBooking = async (id) => {
    try {
      const res = await apiFetch(`/complete/${id}`, {
        method: "PUT"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not complete booking");
      }

      getBookings();
      getCustomerProfiles();
    } catch (err) {
      setDashboardError(err.message || "Could not complete booking.");
    }
  };

  const toggleShop = async () => {
    const res = await apiFetch(`/toggle-shop/${barberId}`, {
      method: "PUT"
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || "Could not update shop status");
    }

    setIsOpen(data.isOpen);
    await Promise.all([getChairs(), getBookings(), getCustomerProfiles(), loadAnalyticsOverview()]);
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
      const res = await apiFetch(`/add-service`, {
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not add service");
      }

      setName("");
      setDuration("");
      setPrice("");
      getServices();
    } catch (err) {
      console.error(err);
      setDashboardError(err.message || "Could not add service.");
    }
  };

  const deleteService = async (id) => {
    try {
      const res = await apiFetch(`/delete-service/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not delete service");
      }

      getServices();
    } catch (err) {
      console.error(err);
      setDashboardError(err.message || "Could not delete service.");
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

    const res = await apiFetch(`/book`, {
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
    setWalkInEstimate(null);
    setWalkInEstimateLoading(false);
    getBookings();
    getCustomerProfiles();
  };

  const persistChairs = async (nextChairs) => {
    const cleaned = nextChairs.map((chair) => ({
      ...chair,
      name: chair.name.trim()
    }));

    if (cleaned.some((chair) => !chair.name)) {
      setChairSaveState("changes");
      return alert("Every chair needs a name");
    }

    if (isOpen && !cleaned.some((chair) => chair.isActive)) {
      setChairSaveState("changes");
      return alert("Keep at least one chair active while the shop is open");
    }

    setChairSaveState("saving");

    const res = await apiFetch(`/chairs/${barberId}`, {
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
      setChairSaveState("changes");
      setDashboardError(data.message || "Could not save chairs");
      return alert(data.message || "Could not save chairs");
    }

    setChairs(data.chairs || []);
    setChairSaveState("saved");
    updateStoredUser({ chairs: data.chairs || [] });
    await Promise.all([getBookings(), getCustomerProfiles(), loadAnalyticsOverview()]);
    return true;
  };

  const addChair = () => {
    const nextNumber = chairs.length + 1;

    persistChairs([
      ...chairs,
      {
        id: `chair-local-${Date.now()}`,
        name: `Chair ${nextNumber}`,
        isActive: true
      }
    ]);
  };

  const updateChair = (chairId, updates, { persist = false } = {}) => {
    const nextChairs = chairs.map((chair) => {
      if (chair.id !== chairId) {
        return chair;
      }

      return {
        ...chair,
        ...updates
      };
    });

    if (persist) {
      persistChairs(nextChairs);
      return;
    }

    setChairs(nextChairs);
    setChairSaveState("changes");
  };

  const deleteChair = (chairId) => {
    persistChairs(chairs.filter((chair) => chair.id !== chairId));
  };

  const saveChairs = async () => {
    await persistChairs(chairs);
  };

  const barberMetrics = analyticsData?.barberMetrics;
  const chairMetrics = analyticsData?.chairMetrics;
  const platformMetrics = analyticsData?.platformMetrics;
  const barberOverviewMetrics = analyticsData?.barberOverviewMetrics;
  const filteredBookingHistory = filterHistoryBookings(bookingHistory, {
    searchQuery: historySearchQuery,
    statusFilter: historyStatusFilter,
    startDate: historyStartDate,
    endDate: historyEndDate,
    includeCustomerName: true
  });
  const servicePopularity = barberMetrics?.servicePopularity || [];
  const peakBookingHours = barberMetrics?.peakBookingHours || [];
  const topPerformingShops =
    analyticsData?.topPerformingShops || platformMetrics?.topPerformingShops || [];
  const topServiceCount = servicePopularity[0]?.[1] || 0;
  const topHourCount = peakBookingHours[0]?.[1] || 0;
  const chairPerformanceRows = chairMetrics?.perChair || [];
  const chairRevenueRows = chairPerformanceRows;
  const maxChairRevenue = Math.max(
    ...chairRevenueRows.map((chair) => Number(chair.estimatedRevenue || 0)),
    0
  );
  const totalChairRevenue = Number(chairMetrics?.summary?.totalChairRevenue || 0);
  const totalChairRevenueBookings = chairRevenueRows.reduce(
    (sum, chair) => sum + Number(chair.bookingCount || 0),
    0
  );
  const averageChairBookingValue = totalChairRevenueBookings
    ? Number((totalChairRevenue / totalChairRevenueBookings).toFixed(1))
    : 0;
  const chairRevenueAttentionTarget = chairRevenueRows
    .filter((chair) => chair.isActive && Number(chair.idleMinutes || 0) > 0)
    .slice()
    .sort(
      (a, b) =>
        Number(a.estimatedRevenue || 0) - Number(b.estimatedRevenue || 0) ||
        Number(b.idleMinutes || 0) - Number(a.idleMinutes || 0) ||
        a.chairName.localeCompare(b.chairName)
    )[0];
  const chairRevenueAttentionCopy = chairRevenueAttentionTarget
    ? `${chairRevenueAttentionTarget.chairName} has ${formatCurrency(
        chairRevenueAttentionTarget.estimatedRevenue
      )} revenue and ${formatMinutes(
        chairRevenueAttentionTarget.idleMinutes
      )} idle time in this range.`
    : "Revenue looks balanced across active chairs for this range.";
  const averageServiceDuration =
    services.length > 0
      ? Math.round(
          services.reduce((total, service) => total + Number(service.duration || 0), 0) /
            services.length
        )
      : 0;
  const averageServicePrice =
    services.length > 0
      ? Math.round(
          services.reduce((total, service) => total + Number(service.price || 0), 0) /
            services.length
        )
      : 0;
  const selectedWalkInDuration = selectedServices.reduce(
    (total, service) => total + Number(service.duration || 0),
    0
  );
  const selectedWalkInPrice = selectedServices.reduce(
    (total, service) => total + Number(service.price || 0),
    0
  );
  const activeAnalyticsPresetLabel =
    analyticsPresets.find((preset) => preset.id === analyticsPreset)?.label || "Selected Range";
  const analyticsRangeLabel =
    analyticsPreset === "custom" && analyticsCustomStart && analyticsCustomEnd
      ? `${analyticsCustomStart} to ${analyticsCustomEnd}`
      : activeAnalyticsPresetLabel;
  const isMyAnalyticsScope = analyticsScope === "myself";
  const chairRevenueRangeStart = analyticsData?.range?.start ? new Date(analyticsData.range.start) : null;
  const hasChairRevenueMonthRange =
    chairRevenueRangeStart && !Number.isNaN(chairRevenueRangeStart.getTime()) && analyticsPreset === "month";
  const monthSummaryDayCount = hasChairRevenueMonthRange
    ? new Date(
        chairRevenueRangeStart.getFullYear(),
        chairRevenueRangeStart.getMonth() + 1,
        0
      ).getDate()
    : 0;
  const monthSummaryDays = Array.from({ length: monthSummaryDayCount }, (_, index) => index + 1);
  const chairRevenueMonthRows = chairRevenueRows.map((chair) => {
    const revenueByDay = monthSummaryDays.reduce((map, day) => {
      map[day] = 0;
      return map;
    }, {});

    (chair.revenueHistory || []).forEach((group) => {
      const date = new Date(`${group.date}T00:00:00`);

      if (
        Number.isNaN(date.getTime()) ||
        !hasChairRevenueMonthRange ||
        date.getFullYear() !== chairRevenueRangeStart.getFullYear() ||
        date.getMonth() !== chairRevenueRangeStart.getMonth()
      ) {
        return;
      }

      revenueByDay[date.getDate()] = Number(group.revenue || 0);
    });

    return {
      chairId: chair.chairId,
      chairName: chair.chairName,
      isActive: chair.isActive,
      totalRevenue: Number(chair.estimatedRevenue || 0),
      revenueByDay
    };
  });
  const chairRevenueMonthTotals = monthSummaryDays.reduce((map, day) => {
    map[day] = chairRevenueMonthRows.reduce(
      (sum, chair) => sum + Number(chair.revenueByDay?.[day] || 0),
      0
    );
    return map;
  }, {});
  const monthSummaryPeakRevenue = Math.max(
    ...chairRevenueMonthRows.flatMap((chair) =>
      monthSummaryDays.map((day) => Number(chair.revenueByDay?.[day] || 0))
    ),
    ...monthSummaryDays.map((day) => Number(chairRevenueMonthTotals[day] || 0)),
    0
  );
  const monthSummaryLabel = hasChairRevenueMonthRange
    ? chairRevenueRangeStart.toLocaleString([], { month: "long", year: "numeric" })
    : "This Month";
  const getMonthSummaryDayLabel = (day) => {
    if (!hasChairRevenueMonthRange) {
      return "";
    }

    return new Date(
      chairRevenueRangeStart.getFullYear(),
      chairRevenueRangeStart.getMonth(),
      day
    ).toLocaleString([], { weekday: "short" });
  };
  const getRevenueHeat = (value) => {
    if (!monthSummaryPeakRevenue || !value) {
      return 0;
    }

    return Number((value / monthSummaryPeakRevenue).toFixed(3));
  };
  const shouldShowWalkInEstimate =
    selectedServices.length > 0 &&
    (walkInEstimateLoading ||
      Boolean(walkInEstimate?.available) ||
      Boolean(walkInEstimate?.message) ||
      (walkInBookingType === "scheduled" && !walkInScheduledFor));

  useEffect(() => {
    if (!barberId || selectedServices.length === 0 || selectedWalkInDuration <= 0) {
      setWalkInEstimate(null);
      setWalkInEstimateLoading(false);
      return undefined;
    }

    if (walkInBookingType === "scheduled" && !walkInScheduledFor) {
      setWalkInEstimate(null);
      setWalkInEstimateLoading(false);
      return undefined;
    }

    let ignore = false;

    const loadWalkInEstimate = async () => {
      try {
        setWalkInEstimateLoading(true);

        const res = await apiFetch(`/estimate-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            barberId,
            totalTime: selectedWalkInDuration,
            bookingType: walkInBookingType,
            scheduledFor: walkInBookingType === "scheduled" ? walkInScheduledFor : null
          })
        });
        const data = await res.json();

        if (!ignore) {
          setWalkInEstimate({
            ...data,
            available: res.ok && data.available !== false
          });
        }
      } catch (err) {
        if (!ignore) {
          setWalkInEstimate({
            available: false,
            message: "Could not estimate start time"
          });
        }
      } finally {
        if (!ignore) {
          setWalkInEstimateLoading(false);
        }
      }
    };

    loadWalkInEstimate();

    return () => {
      ignore = true;
    };
  }, [
    barberId,
    selectedServices.length,
    selectedWalkInDuration,
    walkInBookingType,
    walkInScheduledFor
  ]);

  useEffect(() => {
    if (chairRevenueView === "monthlySummary" && analyticsPreset !== "month") {
      setChairRevenueView("overview");
    }
  }, [analyticsPreset, chairRevenueView]);
  const renderSharedAnalyticsFilters = () => (
    <div className="analytics-filter-bar">
      <div className="analytics-filter-pills" role="tablist" aria-label="Analytics date filters">
        {analyticsPresets.map((preset) => (
          <button
            key={preset.id}
            className={`dashboard-nav__button ${
              analyticsPreset === preset.id ? "dashboard-nav__button--active" : ""
            }`}
            onClick={() => {
              setAnalyticsPreset(preset.id);
              if (preset.id !== "month") {
                setChairRevenueView("overview");
              }
            }}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {analyticsPreset === "custom" && (
        <div className="analytics-filter-fields">
          <label className="analytics-filter-field">
            <span>Start Date</span>
            <input
              type="date"
              aria-label="Analytics start date"
              max={analyticsCustomEnd || getLocalDateValue()}
              value={analyticsCustomStart}
              onChange={(e) => setAnalyticsCustomStart(e.target.value)}
            />
          </label>

          <label className="analytics-filter-field">
            <span>End Date</span>
            <input
              type="date"
              aria-label="Analytics end date"
              min={analyticsCustomStart || undefined}
              max={getLocalDateValue()}
              value={analyticsCustomEnd}
              onChange={(e) => setAnalyticsCustomEnd(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );

  const barberSummaryCards = [
    {
      label: "Active Bookings",
      value: activeBookings.length,
      hint: "Live queue + in-progress work"
    },
    {
      label: "Active Chairs",
      value: `${activeChairCount}/${chairs.length || 0}`,
      hint: "Chairs available for service"
    },
    {
      label: "History Entries",
      value: historyCount,
      hint: "Completed and cancelled orders"
    },
    {
      label: "Shop Status",
      value: isOpen ? "Open" : "Closed",
      hint: isOpen ? "Accepting bookings now" : "Bookings paused"
    }
  ];

  const barberShellActions = (
    <>
      <button
        className={`dashboard-shell__action dashboard-shell__action--status ${
          isOpen ? "dashboard-shell__action--danger" : "dashboard-shell__action--success"
        }`}
        onClick={toggleShop}
        type="button"
      >
        {isOpen ? "Close Shop" : "Open Shop"}
      </button>
      {onLogout ? (
        <button className="dashboard-shell__action dashboard-shell__action--ghost" onClick={onLogout} type="button">
          Logout
        </button>
      ) : null}
    </>
  );

  return (
    <DashboardShell
      theme="barber"
      eyebrow="Barber workspace"
      title="Barber Dashboard"
      description="Run the floor, monitor performance, and keep chairs moving from one clean dashboard."
      contextLabel="Signed in as"
      contextValue={user?.name || "Barber"}
      actions={barberShellActions}
      navigation={dashboardSections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      summaryCards={barberSummaryCards}
    >
      {dashboardError ? (
        <p className="form-feedback form-feedback--error">{dashboardError}</p>
      ) : null}

      {activeSection === "chairs" && (
        <section className="dashboard-page-section barber-chairs-page">
          <div className="barber-chairs-page__intro">
            <div>
              <p className="barber-chairs-page__eyebrow">Floor Control</p>
              <h2>Manage Chairs</h2>
              <p>Control chair availability and keep live capacity in sync with the shop floor.</p>
            </div>

            <div className="barber-chairs-page__stats" aria-label="Chair quick stats">
              <article>
                <span>Active Chairs</span>
                <strong>{activeChairCount}</strong>
              </article>
              <article>
                <span>Total Chairs</span>
                <strong>{chairs.length || 0}</strong>
              </article>
              <article>
                <span>Offline</span>
                <strong>{Math.max((chairs.length || 0) - activeChairCount, 0)}</strong>
              </article>
            </div>
          </div>

          <div className="editorial-panel editorial-panel--accent barber-chair-control-panel">
            <div className="editorial-panel__header barber-chair-control-panel__header">
              <h3>Chair Controls</h3>
              <p>Active Chairs: <b>{activeChairCount}</b> / {chairs.length || 0}</p>
              <span className={`barber-chair-save-status barber-chair-save-status--${chairSaveState}`}>
                {chairSaveState === "saving"
                  ? "Saving..."
                  : chairSaveState === "changes"
                  ? "Save changes"
                  : chairSaveState === "error"
                  ? "Save failed"
                  : "Saved"}
              </span>
            </div>

            <div className="barber-chair-grid">
              {chairs.map((chair, index) => (
                <div
                  key={chair.id}
                  className={`chair-editor-row barber-chair-card ${
                    chair.isActive ? "barber-chair-card--active" : "barber-chair-card--inactive"
                  }`}
                  style={{ "--barber-chair-index": index }}
                >
                  <div className="barber-chair-card__top">
                    <span className="barber-chair-card__number">{index + 1}</span>
                    <span className={`status-chip ${chair.isActive ? "status-chip--active" : "status-chip--muted"}`}>
                      {chair.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <label className="barber-chair-card__field">
                    <span>Chair name</span>
                    <input
                      className="app-field app-field--compact"
                      value={chair.name}
                      onChange={(e) => updateChair(chair.id, { name: e.target.value })}
                      placeholder="Chair name"
                    />
                  </label>

                  <div className="barber-chair-card__actions">
                    <button
                      className="app-button app-button--secondary barber-chair-card__toggle"
                      onClick={() => updateChair(chair.id, { isActive: !chair.isActive }, { persist: true })}
                    >
                      {chair.isActive ? "Turn Off" : "Turn On"}
                    </button>

                    <button
                      className="app-button app-button--ghost barber-chair-card__delete"
                      onClick={() => deleteChair(chair.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-actions barber-chair-actions">
              <button className="app-button app-button--secondary" onClick={addChair}>Add Chair</button>
              <button className="app-button app-button--primary" onClick={saveChairs}>Save Chairs</button>
            </div>
          </div>

          <div className="analytics-section-heading barber-chair-heading">
            <h3>Chair Performance</h3>
            <p>Operational chair metrics using the same date range as your analytics dashboard.</p>
          </div>

          <div className="barber-chair-filters">{renderSharedAnalyticsFilters()}</div>

          {analyticsLoading ? (
            <p className="barber-chair-state">Loading chair performance...</p>
          ) : analyticsError ? (
            <p className="barber-chair-state barber-chair-state--error">{analyticsError}</p>
          ) : analyticsPreset === "custom" && !analyticsData ? (
            <p className="barber-chair-state">Select both dates to load a custom analytics range.</p>
          ) : (
            <>
              <div className="analytics-grid barber-chair-performance-grid">
                <article className="analytics-card barber-chair-spotlight-card">
                  <p className="analytics-card__label">Busiest Chair</p>
                  <strong className="analytics-card__value">
                    {chairMetrics?.summary?.busiestChairName || "No chair activity"}
                  </strong>
                  <span className="analytics-card__hint">
                    {chairMetrics?.summary?.busiestChairBookings || 0} bookings in this range
                  </span>
                </article>
              </div>

              {chairPerformanceRows.length === 0 ? (
                <p className="barber-chair-state">No chair activity in this range.</p>
              ) : (
                <>
                  {chairPerformanceRows.every((chair) => chair.bookingCount === 0) && (
                    <p className="barber-chair-state">No chair activity in this range.</p>
                  )}

                  <div className="analytics-panels analytics-panels--full barber-chair-panels">
                    <article className="analytics-panel barber-chair-performance-panel">
                      <div className="analytics-panel__header">
                        <h3>Per-Chair Performance</h3>
                        <p>Bookings, service time, utilization, and idle time by chair.</p>
                      </div>

                      <div className="analytics-bars barber-chair-performance-list">
                        {chairPerformanceRows.map((chair) => (
                          <div className="analytics-chair-card" key={chair.chairId}>
                            <div className="analytics-bar-row__text">
                              <span>
                                {chair.chairName}
                                {!chair.isActive ? " (Inactive)" : ""}
                              </span>
                              <strong>{chair.bookingCount} bookings</strong>
                            </div>
                            <div className="analytics-chair-stats">
                              <span>Avg Service: {formatMinutes(chair.averageServiceMinutes)}</span>
                              <span>Utilization: {formatPercentage(chair.utilizationRate)}</span>
                              <span>Idle Time: {formatMinutes(chair.idleMinutes)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {activeSection === "chairRevenue" && (
        <section className="dashboard-page-section barber-chair-revenue-page">
          <div className="barber-chair-revenue-page__intro">
            <div>
              <p className="barber-chair-revenue-page__eyebrow">Chair Ledger</p>
              <h2>Chair Revenue</h2>
              <p>Track revenue by chair, compare completed earnings, and spot where idle time is muting sales.</p>
            </div>

            <div className="barber-chair-revenue-page__stats" aria-label="Chair revenue quick stats">
              <article>
                <span>Range</span>
                <strong>{analyticsRangeLabel}</strong>
              </article>
              <article>
                <span>Revenue</span>
                <strong>{formatCurrency(totalChairRevenue)}</strong>
              </article>
              <article>
                <span>Top Chair</span>
                <strong>{chairMetrics?.summary?.topRevenueChairName || "No chair revenue"}</strong>
              </article>
            </div>
          </div>

          <div className="barber-chair-revenue-filters">
            {renderSharedAnalyticsFilters()}
            <div className="barber-chair-revenue-view-toggle" aria-label="Chair revenue summary view">
              <button
                className={`dashboard-nav__button ${
                  chairRevenueView === "overview" ? "dashboard-nav__button--active" : ""
                }`}
                type="button"
                onClick={() => setChairRevenueView("overview")}
              >
                Overview
              </button>
              <button
                className={`dashboard-nav__button ${
                  chairRevenueView === "monthlySummary" ? "dashboard-nav__button--active" : ""
                }`}
                type="button"
                onClick={() => {
                  setAnalyticsPreset("month");
                  setChairRevenueView("monthlySummary");
                }}
              >
                Month Summary
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <p className="barber-chair-revenue-state">Loading chair revenue...</p>
          ) : analyticsError ? (
            <p className="barber-chair-revenue-state barber-chair-revenue-state--error">{analyticsError}</p>
          ) : analyticsPreset === "custom" && !analyticsData ? (
            <p className="barber-chair-revenue-state">
              Select both dates to load a custom analytics range.
            </p>
          ) : (
            <>
              <div className="analytics-grid barber-chair-revenue-grid">
                <article className="analytics-card barber-chair-revenue-card">
                  <p className="analytics-card__label">Total Chair Revenue</p>
                  <strong className="analytics-card__value">
                    {formatCurrency(totalChairRevenue)}
                  </strong>
                  <span className="analytics-card__hint">Assigned to chairs in this range</span>
                </article>

                <article className="analytics-card barber-chair-revenue-card">
                  <p className="analytics-card__label">Top Earning Chair</p>
                  <strong className="analytics-card__value">
                    {chairMetrics?.summary?.topRevenueChairName || "No chair revenue"}
                  </strong>
                  <span className="analytics-card__hint">
                    {formatCurrency(chairMetrics?.summary?.topRevenue || 0)}
                  </span>
                </article>

                <article className="analytics-card barber-chair-revenue-card">
                  <p className="analytics-card__label">Avg Booking Value</p>
                  <strong className="analytics-card__value">
                    {formatCurrency(averageChairBookingValue)}
                  </strong>
                  <span className="analytics-card__hint">
                    {totalChairRevenueBookings} chair bookings counted
                  </span>
                </article>

                <article className="analytics-card barber-chair-revenue-card">
                  <p className="analytics-card__label">Unassigned Revenue</p>
                  <strong className="analytics-card__value">
                    {formatCurrency(chairMetrics?.summary?.unassignedRevenue || 0)}
                  </strong>
                  <span className="analytics-card__hint">Revenue without a chair assignment</span>
                </article>
              </div>

              {chairRevenueView === "monthlySummary" ? (
                <article className="analytics-panel barber-chair-revenue-panel barber-chair-revenue-monthly">
                  <div className="analytics-panel__header">
                    <h3>Monthly Chair Revenue Summary</h3>
                    <p>{monthSummaryLabel} daily chair revenue with row totals and a bottom rollup.</p>
                  </div>

                  <div className="barber-chair-revenue-monthly-board-wrap">
                    <div className="barber-chair-revenue-monthly-board">
                      <div className="barber-chair-revenue-monthly-row barber-chair-revenue-monthly-row--header">
                        <div className="barber-chair-revenue-monthly-rail barber-chair-revenue-monthly-rail--header">
                          <span>Chair</span>
                          <strong>Daily Ledger</strong>
                        </div>

                        <div className="barber-chair-revenue-monthly-scroll">
                          <div className="barber-chair-revenue-monthly-days">
                            {monthSummaryDays.map((day) => (
                              <div className="barber-chair-revenue-day-chip" key={`header-${day}`}>
                                <strong>{day}</strong>
                                <span>{getMonthSummaryDayLabel(day)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="barber-chair-revenue-monthly-total barber-chair-revenue-monthly-total--header">
                          <span>Total</span>
                          <strong>Month</strong>
                        </div>
                      </div>

                      {chairRevenueMonthRows.map((chair) => (
                        <div className="barber-chair-revenue-monthly-row" key={chair.chairId}>
                          <div className="barber-chair-revenue-monthly-rail">
                            <strong>
                              {chair.chairName}
                              {!chair.isActive ? " (Inactive)" : ""}
                            </strong>
                            <span>{formatCurrency(chair.totalRevenue)}</span>
                          </div>

                          <div className="barber-chair-revenue-monthly-scroll">
                            <div className="barber-chair-revenue-monthly-days">
                              {monthSummaryDays.map((day) => {
                                const revenue = Number(chair.revenueByDay?.[day] || 0);

                                return (
                                  <div
                                    className={`barber-chair-revenue-day-cell ${
                                      revenue ? "barber-chair-revenue-day-cell--active" : ""
                                    }`}
                                    key={`${chair.chairId}-${day}`}
                                    style={{
                                      "--revenue-heat": getRevenueHeat(revenue)
                                    }}
                                  >
                                    <span className="barber-chair-revenue-day-cell__date">{day}</span>
                                    <strong>{revenue ? formatCurrency(revenue) : "-"}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="barber-chair-revenue-monthly-total">
                            <span>Total</span>
                            <strong>{formatCurrency(chair.totalRevenue)}</strong>
                          </div>
                        </div>
                      ))}

                      <div className="barber-chair-revenue-monthly-row barber-chair-revenue-monthly-row--totals">
                        <div className="barber-chair-revenue-monthly-rail barber-chair-revenue-monthly-rail--totals">
                          <span>All Chairs</span>
                          <strong>Total</strong>
                        </div>

                        <div className="barber-chair-revenue-monthly-scroll">
                          <div className="barber-chair-revenue-monthly-days">
                            {monthSummaryDays.map((day) => {
                              const revenue = Number(chairRevenueMonthTotals[day] || 0);

                              return (
                                <div
                                  className={`barber-chair-revenue-day-cell barber-chair-revenue-day-cell--total ${
                                    revenue ? "barber-chair-revenue-day-cell--active" : ""
                                  }`}
                                  key={`total-${day}`}
                                  style={{
                                    "--revenue-heat": getRevenueHeat(revenue)
                                  }}
                                >
                                  <span className="barber-chair-revenue-day-cell__date">{day}</span>
                                  <strong>{revenue ? formatCurrency(revenue) : "-"}</strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="barber-chair-revenue-monthly-total barber-chair-revenue-monthly-total--grand">
                          <span>Grand Total</span>
                          <strong>{formatCurrency(totalChairRevenue)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
              <div className="analytics-panels analytics-panels--full barber-chair-revenue-panels">
                <article className="analytics-panel barber-chair-revenue-panel">
                  <div className="analytics-panel__header">
                    <h3>Per-Chair Revenue</h3>
                    <p>Estimated revenue, completed revenue, booking value, and earning pace by chair.</p>
                  </div>

                  {chairRevenueRows.length === 0 ? (
                    <p>No chair revenue data yet.</p>
                  ) : (
                    <div className="analytics-bars barber-chair-revenue-list">
                      {chairRevenueRows.map((chair) => {
                        const isExpanded = expandedChairRevenueIds.includes(chair.chairId);
                        const revenueHistory = chair.revenueHistory || [];

                        return (
                        <div className="analytics-chair-card barber-chair-revenue-row" key={chair.chairId}>
                          <div className="analytics-bar-row__text">
                            <span>
                              {chair.chairName}
                              {!chair.isActive ? " (Inactive)" : ""}
                            </span>
                            <strong>{formatCurrency(chair.estimatedRevenue)}</strong>
                          </div>
                          <div className="analytics-bar-track">
                            <div
                              className="analytics-bar-fill barber-chair-revenue-fill"
                              style={{
                                width: `${
                                  maxChairRevenue
                                    ? Math.max(12, (Number(chair.estimatedRevenue || 0) / maxChairRevenue) * 100)
                                    : 0
                                }%`
                              }}
                            />
                          </div>
                          <div className="analytics-chair-stats barber-chair-revenue-stats">
                            <span>Completed: {formatCurrency(chair.completedRevenue)}</span>
                            <span>Bookings: {chair.bookingCount}</span>
                            <span>Avg Ticket: {formatCurrency(chair.averageBookingValue)}</span>
                            <span>Per Service Hour: {formatCurrency(chair.revenuePerServiceHour)}</span>
                          </div>

                          <button
                            className="app-button app-button--secondary barber-chair-revenue-toggle"
                            type="button"
                            onClick={() => toggleChairRevenueHistory(chair.chairId)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? "Hide Transactions" : "Show Transactions"}
                          </button>

                          {isExpanded && (
                            <div className="barber-chair-revenue-history">
                              <div className="barber-chair-revenue-history__header">
                                <strong>Transaction history</strong>
                                <span>{revenueHistory.length} dates</span>
                              </div>

                              {revenueHistory.length === 0 ? (
                                <p className="barber-chair-revenue-history__empty">
                                  No transactions for this chair in the selected range.
                                </p>
                              ) : (
                                <div className="barber-chair-revenue-history__dates">
                                  {revenueHistory.map((group) => (
                                    <div className="barber-chair-revenue-date" key={group.date}>
                                      <div className="barber-chair-revenue-date__header">
                                        <strong>{group.date}</strong>
                                        <span>{formatCurrency(group.revenue)}</span>
                                      </div>
                                      <div className="barber-chair-revenue-transactions">
                                        {group.transactions.map((transaction) => (
                                          <div
                                            className="barber-chair-revenue-transaction"
                                            key={transaction.bookingId || `${group.date}-${transaction.eventTime}`}
                                          >
                                            <div>
                                              <strong>{transaction.customerName}</strong>
                                              <span>
                                                {formatTransactionTime(transaction.eventTime)} /{" "}
                                                {transaction.status}
                                              </span>
                                            </div>
                                            <div>
                                              <span>
                                                {(transaction.services || []).join(", ") || "Service not listed"}
                                              </span>
                                              <strong>{formatCurrency(transaction.revenue)}</strong>
                                            </div>
                                            {transaction.orderId && (
                                              <p>Order: {transaction.orderId}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </article>

                <article className="analytics-panel barber-chair-revenue-panel barber-chair-revenue-attention">
                  <div className="analytics-panel__header">
                    <h3>Revenue Attention</h3>
                    <p>One practical signal to help decide where the next walk-in or promotion should go.</p>
                  </div>
                  <strong>
                    {chairRevenueAttentionTarget
                      ? chairRevenueAttentionTarget.chairName
                      : "Balanced floor"}
                  </strong>
                  {chairRevenueAttentionTarget && (
                    <div className="barber-chair-revenue-attention__stats">
                      <div>
                        <span>Total Time Worked</span>
                        <strong>{formatMinutes(chairRevenueAttentionTarget.totalServiceMinutes)}</strong>
                      </div>
                      <div>
                        <span>Revenue Generated</span>
                        <strong>{formatCurrency(chairRevenueAttentionTarget.estimatedRevenue)}</strong>
                      </div>
                    </div>
                  )}
                  <p>{chairRevenueAttentionCopy}</p>
                </article>
              </div>
              )}
            </>
          )}
        </section>
      )}

      {activeSection === "services" && (
        <section className="dashboard-page-section barber-services-page">
          <div className="barber-services-page__intro">
            <div>
              <p className="barber-services-page__eyebrow">Menu Studio</p>
              <h2>Add Service</h2>
              <p>Curate your menu with clear pricing and durations that customers can trust.</p>
            </div>

            <div className="barber-services-page__stats" aria-label="Service quick stats">
              <article>
                <span>Services</span>
                <strong>{services.length}</strong>
              </article>
              <article>
                <span>Avg Time</span>
                <strong>{averageServiceDuration} min</strong>
              </article>
              <article>
                <span>Avg Price</span>
                <strong>Rs {averageServicePrice}</strong>
              </article>
            </div>
          </div>

          <div className="editorial-panel barber-service-composer">
            <div className="editorial-panel__header barber-service-composer__header">
              <h3>Build Your Menu</h3>
              <p>Add services with durations and prices that flow directly into booking totals.</p>
            </div>

            <div className="form-grid barber-service-form-grid">
              <label className="field-group">
                <span>Service Name</span>
                <input className="app-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Service Name" />
              </label>

              <label className="field-group">
                <span>Duration (min)</span>
                <input className="app-field" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (min)" />
              </label>

              <label className="field-group">
                <span>Price</span>
                <input className="app-field" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
              </label>
            </div>

            <div className="form-actions barber-service-actions">
              <button className="app-button app-button--primary" onClick={addService}>Add Service</button>
            </div>

            <div className="barber-service-menu-header">
              <div>
                <p className="barber-services-page__eyebrow">Live Menu</p>
                <h3>Customer-facing services</h3>
              </div>
              <span>{services.length} listed</span>
            </div>

            {services.length === 0 ? (
              <div className="barber-service-empty">
                <h3>No services yet.</h3>
                <p>Add your first service so customers can start booking with clear timing and pricing.</p>
              </div>
            ) : (
              <div className="service-list barber-service-list">
                {services.map((service, index) => (
                  <div
                    key={service._id}
                    className="service-list-item barber-service-card"
                    style={{ "--barber-service-index": index }}
                  >
                    <div className="barber-service-card__main">
                      <span className="barber-service-card__number">{index + 1}</span>
                      <div>
                        <strong>{service.name}</strong> ({service.duration} min, Rs {service.price || 0})
                        <div className="barber-service-card__chips">
                          <span>{service.duration} min</span>
                          <span>Rs {service.price || 0}</span>
                        </div>
                      </div>
                    </div>
                    <button className="app-button app-button--ghost barber-service-card__delete" onClick={() => deleteService(service._id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === "queue" && (
        <section className="dashboard-page-section barber-queue-page">
          <div className="barber-queue-page__intro">
            <div>
              <p className="barber-queue-page__eyebrow">Shop floor command</p>
              <h2>Live Queue</h2>
              <p>See every customer, chair assignment, and service state in a cleaner operational view.</p>
            </div>

            <div className="barber-queue-page__stats">
              <article>
                <span>Ready</span>
                <strong>{readyBookings.length}</strong>
              </article>
              <article>
                <span>In chair</span>
                <strong>{inProgressBookings.length}</strong>
              </article>
              <article>
                <span>Active chairs</span>
                <strong>{activeChairCount}</strong>
              </article>
            </div>
          </div>

          <div className="barber-queue-page__board">
            <QueueBoard chairs={chairs} bookings={activeBookings} title="Per-Chair Live Queue" />
          </div>

          {activeBookings.length === 0 ? (
            <div className="barber-queue-empty">
              <p className="barber-queue-page__eyebrow">Quiet floor</p>
              <h3>No active bookings right now.</h3>
              <p>New customer bookings and walk-ins will appear here when the shop starts moving.</p>
            </div>
          ) : (
            <div className="barber-active-list">
              {activeBookings.map((booking, index) => {
              const waitTime = calculateWait(booking);
              const loyaltyProfile = getProfileForBooking(booking);

              return (
                <div
                  key={booking._id}
                  className={`booking-activity-card barber-active-card ${
                    booking.status === "in-progress" ? "booking-activity-card--live barber-active-card--live" : ""
                  }`}
                  style={{ "--barber-active-index": index }}
                >
                  <div className="barber-active-card__top">
                    <div>
                      <p className="barber-active-card__eyebrow">
                        {booking.status === "in-progress" ? "Service in progress" : waitTime === 0 ? "Ready to start" : "Waiting"}
                      </p>
                      <h3>
                        {index + 1}. {booking.customerName}
                      </h3>
                    </div>
                    <span className="barber-active-card__timer">
                      {booking.status === "in-progress" ? `${getRemaining(booking)} min left` : `${waitTime} min wait`}
                    </span>
                  </div>

                  <div className="loyalty-summary barber-loyalty-strip">
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

                  <div className="barber-active-card__services">
                    {booking.services?.map((service, serviceIndex) => (
                      <span key={serviceIndex} className="service-chip">
                        {service}
                      </span>
                    ))}
                  </div>

                  <div className="barber-active-card__details">
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
                  </div>

                  {booking.bookingType === "scheduled" && (
                    <p className="barber-active-card__scheduled">Scheduled: {new Date(booking.startTime).toLocaleString()}</p>
                  )}

                  <p className="barber-active-card__actual-start">
                    Actual Start:{" "}
                    {booking.actualStartTime
                      ? new Date(booking.actualStartTime).toLocaleTimeString()
                      : "none"}
                  </p>

                  <p className="booking-activity-card__status booking-activity-card__status--strong">
                    {booking.status === "in-progress" ? (
                      <span className="booking-activity-card__status booking-activity-card__status--live">
                        In Progress ({getRemaining(booking)} min left)
                      </span>
                    ) : (
                      <span>Waiting: {waitTime} min</span>
                    )}
                  </p>

                  {booking.status !== "in-progress" && waitTime === 0 && (
                    <button className="app-button app-button--secondary barber-active-card__start" onClick={() => startBooking(booking._id)}>Start</button>
                  )}

                  {booking.status === "in-progress" && (
                    <button className="app-button app-button--primary barber-active-card__complete" onClick={() => completeBooking(booking._id)}>Complete</button>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </section>
      )}

      {activeSection === "analytics" && (
        <section className="dashboard-page-section barber-analytics-page">
          <div className="barber-analytics-page__intro">
            <div>
              <p className="barber-analytics-page__eyebrow">Performance Studio</p>
              <h2>Analytics Dashboard</h2>
              <p>
                Track shop demand, revenue signals, peak hours, and platform movement from one
                focused control room.
              </p>
            </div>

            <div className="barber-analytics-page__stats" aria-label="Analytics quick stats">
              <article>
                <span>Range</span>
                <strong>{analyticsRangeLabel}</strong>
              </article>
              <article>
                <span>Bookings</span>
                <strong>{barberMetrics?.totalBookings || 0} tracked</strong>
              </article>
              <article>
                <span>Revenue</span>
                <strong>Rs. {barberMetrics?.estimatedRevenue || 0}</strong>
              </article>
            </div>
          </div>

          <div className="barber-analytics-page__filters">{renderSharedAnalyticsFilters()}</div>

          {analyticsLoading ? (
            <p className="barber-analytics-page__state">Loading analytics...</p>
          ) : analyticsError ? (
            <p className="barber-analytics-page__state barber-analytics-page__state--error">
              {analyticsError}
            </p>
          ) : analyticsPreset === "custom" && !analyticsData ? (
            <p className="barber-analytics-page__state">
              Select both dates to load a custom analytics range.
            </p>
          ) : (
            <>
              <div className="analytics-section-heading barber-analytics-heading">
                <h3>Barber Performance</h3>
                <p>Your shop metrics for the selected date range.</p>
              </div>

              <div className="analytics-grid barber-analytics-grid barber-analytics-grid--performance">
                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">Total Bookings</p>
                  <strong className="analytics-card__value">{barberMetrics?.totalBookings || 0}</strong>
                  <span className="analytics-card__hint">Active + completed bookings</span>
                </article>

                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">Estimated Revenue</p>
                  <strong className="analytics-card__value">
                    Rs {barberMetrics?.estimatedRevenue || 0}
                  </strong>
                  <span className="analytics-card__hint">Based on current service prices</span>
                </article>
              </div>

              <div className="analytics-panels barber-analytics-panels">
                <article className="analytics-panel barber-analytics-panel">
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

                <article className="analytics-panel barber-analytics-panel">
                  <div className="analytics-panel__header">
                    <h3>Peak Booking Hours</h3>
                    <p>Most active booking windows from saved booking activity.</p>
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

              <div className="analytics-section-heading barber-analytics-heading barber-analytics-heading--scoped">
                <div>
                  <h3>{isMyAnalyticsScope ? "My Shop Overview" : "Platform Overview"}</h3>
                  <p>
                    {isMyAnalyticsScope
                      ? "Your shop metrics for the selected date range."
                      : "Cross-shop metrics that make the dashboard feel more like a real admin surface."}
                  </p>
                </div>
                <div className="analytics-scope-toggle" aria-label="Analytics scope">
                  <button
                    className={`analytics-scope-toggle__button ${
                      !isMyAnalyticsScope ? "analytics-scope-toggle__button--active" : ""
                    }`}
                    onClick={() => setAnalyticsScope("overall")}
                    type="button"
                  >
                    Overall
                  </button>
                  <button
                    className={`analytics-scope-toggle__button ${
                      isMyAnalyticsScope ? "analytics-scope-toggle__button--active" : ""
                    }`}
                    onClick={() => setAnalyticsScope("myself")}
                    type="button"
                  >
                    Myself
                  </button>
                </div>
              </div>

              <div className="analytics-grid barber-analytics-grid barber-analytics-grid--platform">
                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">
                    {isMyAnalyticsScope ? "My Shop" : "All-Barber Overview"}
                  </p>
                  <strong className="analytics-card__value">
                    {isMyAnalyticsScope
                      ? (barberOverviewMetrics?.shopOverview?.isOpen ?? isOpen)
                        ? "Open"
                        : "Closed"
                      : platformMetrics?.allBarberOverview?.totalBarbers || 0}
                  </strong>
                  <span className="analytics-card__hint">
                    {isMyAnalyticsScope
                      ? "Shop status right now"
                      : `${platformMetrics?.allBarberOverview?.openShops || 0} open shops right now`}
                  </span>
                </article>

                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">
                    {isMyAnalyticsScope ? "My Bookings" : "Total Platform Bookings"}
                  </p>
                  <strong className="analytics-card__value">
                    {isMyAnalyticsScope
                      ? barberOverviewMetrics?.totalBookings || 0
                      : platformMetrics?.totalPlatformBookings || 0}
                  </strong>
                  <span className="analytics-card__hint">
                    {isMyAnalyticsScope
                      ? "Your shop in the selected range"
                      : "All shops in the selected range"}
                  </span>
                </article>

                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">Customer Growth</p>
                  <strong className="analytics-card__value">
                    {isMyAnalyticsScope
                      ? barberOverviewMetrics?.customerGrowth || 0
                      : platformMetrics?.customerGrowth || 0}
                  </strong>
                  <span className="analytics-card__hint">New customers in this period</span>
                </article>

                <article className="analytics-card barber-analytics-card">
                  <p className="analytics-card__label">Cancellation Rate</p>
                  <strong className="analytics-card__value">
                    {formatPercentage(
                      isMyAnalyticsScope
                        ? barberOverviewMetrics?.cancellationRate
                        : platformMetrics?.cancellationRate
                    )}
                  </strong>
                  <span className="analytics-card__hint">
                    {isMyAnalyticsScope
                      ? "Cancelled bookings for your shop"
                      : "Cancelled bookings across the platform"}
                  </span>
                </article>
              </div>

              {!isMyAnalyticsScope && (
                <div className="analytics-panels analytics-panels--full barber-analytics-panels">
                  <article className="analytics-panel barber-analytics-panel barber-analytics-panel--wide">
                    <div className="analytics-panel__header">
                      <h3>Top Performing Shops</h3>
                      <p>Shops ranked by booking volume for the active date range.</p>
                    </div>

                    {topPerformingShops.length === 0 ? (
                      <p>No shop performance data yet.</p>
                    ) : (
                      <div className="analytics-bars barber-top-shops">
                        {topPerformingShops.map((shop, index) => (
                          <div className="barber-top-shop-card" key={shop.barberId || shop.shopName}>
                            <span className="barber-top-shop-card__rank">{index + 1}</span>
                            <div className="barber-top-shop-card__main">
                              <span className="barber-top-shop-card__label">Ranked shop</span>
                              <strong>
                                {index + 1}. {shop.shopName}
                              </strong>
                              <p>{shop.barberName}</p>
                            </div>
                            <div className="barber-top-shop-card__score">
                              <strong>{shop.bookings}</strong>
                              <span>bookings</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeSection === "history" && (
        <section className="dashboard-page-section barber-history-page">
          <div className="barber-history-page__intro">
            <div>
              <p className="barber-history-page__eyebrow">Visit Archive</p>
              <h2>Order History</h2>
              <p>Review customer visits, loyalty context, and snapshot-backed totals without losing the audit trail.</p>
            </div>

            <div className="barber-history-page__stats" aria-label="History quick stats">
              <article>
                <span>Total records</span>
                <strong>{bookingHistory.length}</strong>
              </article>
              <article>
                <span>Showing</span>
                <strong>{filteredBookingHistory.length}</strong>
              </article>
              <article>
                <span>Completed</span>
                <strong>{bookingHistory.filter((booking) => booking.status === "completed").length}</strong>
              </article>
            </div>
          </div>

          <div className="history-filter-bar barber-history-filters">
            <label className="barber-history-filter-field barber-history-filter-field--search">
              <span>Search archive</span>
              <input
                className="history-filter-input"
                placeholder="Customer, service, or token"
                aria-label="Barber history search"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
              />
            </label>

            <label className="barber-history-filter-field">
              <span>Status</span>
              <select
                className="history-filter-input"
                aria-label="Barber history status"
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="barber-history-filter-field">
              <span>From</span>
              <input
                className="history-filter-input"
                type="date"
                aria-label="Barber history start date"
                max={historyEndDate || getLocalDateValue()}
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
              />
            </label>

            <label className="barber-history-filter-field">
              <span>To</span>
              <input
                className="history-filter-input"
                type="date"
                aria-label="Barber history end date"
                min={historyStartDate || undefined}
                max={getLocalDateValue()}
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
              />
            </label>
          </div>

          {bookingHistory.length === 0 ? (
            <div className="barber-history-empty">
              <p className="barber-history-page__eyebrow">Quiet archive</p>
              <h3>No completed or cancelled orders yet.</h3>
              <p>Completed services and cancelled appointments will land here with loyalty and snapshot details.</p>
            </div>
          ) : filteredBookingHistory.length === 0 ? (
            <div className="barber-history-empty">
              <p className="barber-history-page__eyebrow">No matches</p>
              <h3>No history results match the current filters.</h3>
              <p>Try widening the date range, changing status, or searching with a different customer or service.</p>
            </div>
          ) : (
            <div className="barber-history-list">
              {filteredBookingHistory.map((booking, index) => {
                const loyaltyProfile = getProfileForBooking(booking);
                const isCompleted = booking.status === "completed";
                const serviceNames = getBookingServiceNames(booking);

                return (
                  <div
                    key={booking._id}
                    className={`history-card barber-history-card ${
                      isCompleted ? "barber-history-card--completed" : "barber-history-card--cancelled"
                    }`}
                    style={{ "--barber-history-index": index }}
                  >
                    <span className="barber-history-card__timeline-dot" aria-hidden="true" />
                    <div className="barber-history-card__header">
                      <div>
                        <p className="barber-history-card__eyebrow">
                          {isCompleted ? "Completed visit" : "Cancelled booking"}
                        </p>
                        <h3>{booking.customerName}</h3>
                        <p className="barber-history-card__date">{getHistoryDate(booking)}</p>
                      </div>

                      <div className="barber-history-card__actions">
                        <span className="barber-history-card__status-pill">
                          {isCompleted ? "Completed" : "Cancelled"}
                        </span>
                        <div className="barber-history-card__total">
                          <span>Total</span>
                          <strong>Total: {formatCurrency(getBookingTotalPrice(booking))}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="loyalty-summary barber-history-card__loyalty">
                      <span className={getBadgeClassName(loyaltyProfile.badge)}>
                        {loyaltyProfile.badge}
                      </span>
                      <span className="loyalty-summary__meta">{loyaltyProfile.visitCount} visits</span>
                      <span className="loyalty-summary__meta">
                        {formatCurrency(loyaltyProfile.totalSpend)}
                      </span>
                      <span className="loyalty-summary__meta">
                        Favorite Service: {loyaltyProfile.topService || "No repeat data yet"}
                      </span>
                    </div>

                    <div className="barber-history-card__details">
                      <p>Services: {serviceNames.join(", ")}</p>
                      <p>Order: {booking.orderId}</p>
                      <p>Chair: {booking.chairName || "Not assigned"}</p>
                      <p>Type: {booking.bookingType === "scheduled" ? "Scheduled" : "Instant"}</p>
                      <p>Status: {isCompleted ? "Completed" : "Cancelled"}</p>
                    </div>

                    <div className="barber-history-card__service-chips" aria-label="Booked services">
                      {serviceNames.map((serviceName) => (
                        <span key={serviceName}>{serviceName}</span>
                      ))}
                    </div>

                    {Array.isArray(booking.serviceItems) && booking.serviceItems.length > 0 && (
                      <p className="barber-history-card__snapshot">
                        Snapshot:{" "}
                        {getBookingServiceItems(booking)
                          .map((item) => `${item.name} (${formatCurrency(item.price)})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeSection === "walkins" && (
        <section className="dashboard-page-section barber-walkins-page">
          <div className="barber-walkins-page__intro">
            <div>
              <p className="barber-walkins-page__eyebrow">Front Desk Intake</p>
              <h2>Add Walk-in</h2>
              <p>Create instant or scheduled walk-ins with the same polished booking flow used across the app.</p>
            </div>

            <div className="barber-walkins-page__stats" aria-label="Walk-in quick stats">
              <article>
                <span>Selected</span>
                <strong>{selectedServices.length}</strong>
              </article>
              <article>
                <span>Duration</span>
                <strong>{selectedWalkInDuration} min</strong>
              </article>
              <article>
                <span>Total</span>
                <strong>Rs {selectedWalkInPrice}</strong>
              </article>
            </div>
          </div>

          <div className="editorial-panel barber-walkin-intake">
            <div className="editorial-panel__header barber-walkin-intake__header">
              <h3>Walk-in Ticket</h3>
              <p>Capture the customer, timing, and services before placing them into the live queue.</p>
            </div>

            <div className="barber-walkin-layout">
              <div className="barber-walkin-customer-card">
                <label className="field-group">
                  <span>Customer Name</span>
                  <input
                    className="app-field"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name"
                  />
                </label>

                <div className="choice-pills barber-walkin-mode">
                  <label className={`choice-pill ${walkInBookingType === "instant" ? "choice-pill--active" : ""}`}>
                    <input
                      type="radio"
                      name="walkInBookingType"
                      value="instant"
                      checked={walkInBookingType === "instant"}
                      onChange={() => setWalkInBookingType("instant")}
                    />
                    Instant
                  </label>

                  <label className={`choice-pill ${walkInBookingType === "scheduled" ? "choice-pill--active" : ""}`}>
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
                  <label className="field-group barber-walkin-schedule">
                    <span>Scheduled For</span>
                    <input
                      className="app-field"
                      type="datetime-local"
                      value={walkInScheduledFor}
                      min={getLocalDateTimeValue()}
                      onChange={(e) => setWalkInScheduledFor(e.target.value)}
                    />
                  </label>
                )}

                <div className="barber-walkin-readiness">
                  <div className="barber-walkin-readiness__header">
                    <p className="barber-walkins-page__eyebrow">Intake Check</p>
                    <strong>{selectedServices.length > 0 ? "Queue-ready details" : "Build the ticket"}</strong>
                  </div>
                  <div className="barber-walkin-readiness__grid">
                    <div>
                      <span>Customer</span>
                      <strong>{customerName.trim() || "Name needed"}</strong>
                    </div>
                    <div>
                      <span>Services</span>
                      <strong>
                        {selectedServices.length
                          ? `${selectedServices.length} selected`
                          : "Select services"}
                      </strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>{selectedWalkInDuration ? `${selectedWalkInDuration} min` : "0 min"}</strong>
                    </div>
                    <div>
                      <span>Chair</span>
                      <strong>
                        {walkInEstimate?.available
                          ? walkInEstimate.chairName || "Auto assigned"
                          : activeChairCount
                          ? `${activeChairCount} active`
                          : "No active chair"}
                      </strong>
                    </div>
                  </div>
                  {selectedServices.length > 0 ? (
                    <div className="barber-walkin-readiness__chips">
                      {selectedServices.map((service) => (
                        <span key={service._id}>{service.name}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="barber-walkin-readiness__empty">
                      Selected services will appear here before the walk-in is placed in the queue.
                    </p>
                  )}
                </div>
              </div>

              <aside className="barber-walkin-summary">
                <p className="barber-walkins-page__eyebrow">Ticket Summary</p>
                <h3>{customerName || "New walk-in"}</h3>
                <div>
                  <span>Mode</span>
                  <strong>{walkInBookingType === "scheduled" ? "Scheduled" : "Instant"}</strong>
                </div>
                <div>
                  <span>Services</span>
                  <strong>{selectedServices.length}</strong>
                </div>
                <div>
                  <span>Estimate</span>
                  <strong>{selectedWalkInDuration} min / Rs {selectedWalkInPrice}</strong>
                </div>
                {shouldShowWalkInEstimate && (
                  <div className="booking-estimate-card barber-walkin-estimate">
                    {walkInEstimateLoading ? (
                      <p>Checking expected start...</p>
                    ) : walkInEstimate?.available ? (
                      <div className="booking-estimate-card__stats barber-walkin-estimate__stats">
                        <p className="barber-walkin-estimate__label">Queue preview</p>
                        <p className="barber-walkin-estimate__start">
                          Expected start:{" "}
                          <strong>{new Date(walkInEstimate.estimatedStartTime).toLocaleTimeString()}</strong>
                        </p>
                        <div className="barber-walkin-estimate__details">
                          <p>
                            Waiting: <strong>{walkInEstimate.waitMinutes || 0} min</strong>
                          </p>
                          <p>
                            Chair: <strong>{walkInEstimate.chairName || "Auto assigned"}</strong>
                          </p>
                        </div>
                      </div>
                    ) : walkInEstimate?.message ? (
                      <p className="form-feedback form-feedback--error">{walkInEstimate.message}</p>
                    ) : walkInBookingType === "scheduled" && !walkInScheduledFor ? (
                      <p>Select scheduled time to see expected start</p>
                    ) : null}
                  </div>
                )}
              </aside>
            </div>

            <div className="barber-walkin-service-header">
              <div>
                <p className="barber-walkins-page__eyebrow">Service Picker</p>
                <h3>Choose services</h3>
              </div>
              <span>{services.length} available</span>
            </div>

            <div className="service-list barber-walkin-service-list">
              {services.map((service, index) => {
                const isSelected = selectedServices.find((item) => item._id === service._id);

                return (
                  <div
                    key={service._id}
                    className={`service-list-item barber-walkin-service-card ${
                      isSelected ? "barber-walkin-service-card--selected" : ""
                    }`}
                    style={{ "--barber-walkin-index": index }}
                  >
                    <div className="barber-walkin-service-card__main">
                      <span className="barber-walkin-service-card__mark">
                        {isSelected ? "On" : index + 1}
                      </span>
                      <div>
                        <strong>{service.name}</strong> ({service.duration} min, Rs {service.price || 0})
                        <div className="barber-walkin-service-card__chips">
                          <span>{service.duration} min</span>
                          <span>Rs {service.price || 0}</span>
                        </div>
                      </div>
                    </div>
                    <button className="app-button app-button--secondary barber-walkin-service-card__select" onClick={() => toggleServiceSelection(service)}>
                      {isSelected ? "Remove" : "Select"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="form-actions barber-walkin-actions">
              <div className="barber-walkin-actions__hint">
                <span>Ready for queue</span>
                <strong>{selectedServices.length > 0 ? "Services selected" : "Select at least one service"}</strong>
              </div>
              <button className="app-button app-button--primary" onClick={addOfflineBooking}>Add to Queue</button>
            </div>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

export default BarberDashboard;
