const Booking = require("../models/Booking");
const User = require("../models/User");
const {
  buildLegacyServicePriceMap,
  getBookingTotalPrice
} = require("./bookingSnapshots");

const PRESET_VALUES = new Set(["today", "week", "month", "custom"]);

const getValidDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getBookingEventDate = (booking) => {
  if (booking.status === "cancelled") {
    return (
      getValidDate(booking.cancelledAt) ||
      getValidDate(booking.updatedAt) ||
      getValidDate(booking.startTime) ||
      getValidDate(booking.createdAt)
    );
  }

  if (booking.status === "completed") {
    return (
      getValidDate(booking.completedAt) ||
      getValidDate(booking.updatedAt) ||
      getValidDate(booking.startTime) ||
      getValidDate(booking.createdAt)
    );
  }

  return (
    getValidDate(booking.startTime) ||
    getValidDate(booking.scheduledFor) ||
    getValidDate(booking.createdAt) ||
    getValidDate(booking.updatedAt)
  );
};

const getRangeForPreset = ({ rangePreset = "today", now = new Date(), startDate, endDate }) => {
  const normalizedPreset = PRESET_VALUES.has(rangePreset) ? rangePreset : "today";
  const today = getValidDate(now) || new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (normalizedPreset === "custom") {
    const customStart = getValidDate(startDate);
    const customEnd = getValidDate(endDate);

    if (!customStart || !customEnd) {
      throw new Error("Custom range requires valid startDate and endDate");
    }

    customStart.setHours(0, 0, 0, 0);
    customEnd.setHours(23, 59, 59, 999);

    if (customStart > customEnd) {
      throw new Error("Custom range startDate must be before endDate");
    }

    return {
      rangePreset: normalizedPreset,
      start: customStart,
      end: customEnd
    };
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (normalizedPreset === "week") {
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
  } else if (normalizedPreset === "month") {
    start.setDate(1);
  }

  return {
    rangePreset: normalizedPreset,
    start,
    end
  };
};

const buildServicePopularity = (bookings) =>
  Object.entries(
    bookings.reduce((counts, booking) => {
      (booking.services || []).forEach((serviceName) => {
        counts[serviceName] = (counts[serviceName] || 0) + 1;
      });
      return counts;
    }, {})
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const buildPeakBookingHours = (bookings) =>
  Object.entries(
    bookings.reduce((counts, booking) => {
      const eventDate = getBookingEventDate(booking);

      if (!eventDate) {
        return counts;
      }

      const hour = eventDate.getHours();
      const label = `${String(hour).padStart(2, "0")}:00`;
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {})
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const buildBarberMetrics = async ({ barberId, bookings }) => {
  const legacyServiceMap = await buildLegacyServicePriceMap(barberId);
  const nonCancelledBookings = bookings.filter((booking) => booking.status !== "cancelled");

  return {
    totalBookings: nonCancelledBookings.length,
    estimatedRevenue: nonCancelledBookings.reduce(
      (sum, booking) => sum + getBookingTotalPrice(booking, legacyServiceMap),
      0
    ),
    servicePopularity: buildServicePopularity(nonCancelledBookings),
    peakBookingHours: buildPeakBookingHours(nonCancelledBookings)
  };
};

const buildPlatformMetrics = ({ bookings, allBookings, barbersById, range }) => {
  const totalPlatformBookings = bookings.length;
  const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;
  const completedOrActiveBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const topPerformingShops = Object.values(
    bookings.reduce((map, booking) => {
      const shop = barbersById[String(booking.barberId)];
      const key = String(booking.barberId || "unknown");

      if (!map[key]) {
        map[key] = {
          barberId: booking.barberId || "",
          shopName: shop?.shopName || "Unknown Shop",
          barberName: shop?.name || "Unknown Barber",
          bookings: 0
        };
      }

      map[key].bookings += 1;
      return map;
    }, {})
  )
    .sort((a, b) => b.bookings - a.bookings || a.shopName.localeCompare(b.shopName))
    .slice(0, 5);

  return {
    allBarberOverview: {
      totalBarbers: Object.keys(barbersById).length,
      openShops: Object.values(barbersById).filter((barber) => barber.isOpen).length
    },
    totalPlatformBookings,
    customerGrowth: buildCustomerGrowth({ bookings: allBookings, range }),
    cancellationRate: totalPlatformBookings
      ? Number(((cancelledBookings / totalPlatformBookings) * 100).toFixed(1))
      : 0,
    topPerformingShops,
    activeBarberBookings: completedOrActiveBookings.length
  };
};

const buildCustomerGrowth = ({ bookings, range }) => {
  const firstBookingByCustomer = new Map();

  bookings.forEach((booking) => {
    if (!booking.customerId) {
      return;
    }

    const eventDate = getBookingEventDate(booking);

    if (!eventDate) {
      return;
    }

    const existing = firstBookingByCustomer.get(String(booking.customerId));
    if (!existing || eventDate < existing) {
      firstBookingByCustomer.set(String(booking.customerId), eventDate);
    }
  });

  return [...firstBookingByCustomer.values()].filter(
    (date) => date >= range.start && date <= range.end
  ).length;
};

const filterBookingsByRange = ({ bookings, range }) =>
  bookings.filter((booking) => {
    const eventDate = getBookingEventDate(booking);
    return eventDate && eventDate >= range.start && eventDate <= range.end;
  });

const getAnalyticsOverview = async ({
  barberId,
  rangePreset = "today",
  startDate,
  endDate,
  now = new Date()
}) => {
  if (!barberId) {
    throw new Error("barberId is required");
  }

  const range = getRangeForPreset({ rangePreset, startDate, endDate, now });
  const [allBookings, barbers] = await Promise.all([
    Booking.find().sort({ startTime: 1, createdAt: 1 }),
    User.find({ role: "barber" })
  ]);

  const filteredBookings = filterBookingsByRange({ bookings: allBookings, range });
  const barberBookings = filteredBookings.filter(
    (booking) => String(booking.barberId) === String(barberId)
  );
  const barbersById = barbers.reduce((map, barber) => {
    map[String(barber._id)] = barber;
    return map;
  }, {});
  const platformMetrics = buildPlatformMetrics({
    bookings: filteredBookings,
    allBookings,
    barbersById,
    range
  });

  return {
    range: {
      preset: range.rangePreset,
      start: range.start.toISOString(),
      end: range.end.toISOString()
    },
    barberMetrics: await buildBarberMetrics({
      barberId,
      bookings: barberBookings
    }),
    platformMetrics,
    topPerformingShops: platformMetrics.topPerformingShops
  };
};

module.exports = {
  buildBarberMetrics,
  buildCustomerGrowth,
  buildPeakBookingHours,
  buildPlatformMetrics,
  buildServicePopularity,
  filterBookingsByRange,
  getAnalyticsOverview,
  getBookingEventDate,
  getRangeForPreset,
  getBookingRevenue: getBookingTotalPrice
};
