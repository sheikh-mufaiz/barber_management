const Booking = require("../models/Booking");
const User = require("../models/User");
const {
  buildLegacyServicePriceMap,
  getBookingTotalPrice
} = require("./bookingSnapshots");
const { sanitizeChairs } = require("./chairs");

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

const getRangeDurationMinutes = (range) =>
  Math.max(1, Math.round((range.end.getTime() - range.start.getTime() + 1) / 60000));

const normalizeShopSessions = (shopSessions = []) =>
  Array.isArray(shopSessions)
    ? shopSessions
        .map((session) => {
          const openedAt = getValidDate(session?.openedAt);
          const closedAt = session?.closedAt ? getValidDate(session.closedAt) : null;

          if (!openedAt) {
            return null;
          }

          return {
            openedAt,
            closedAt: closedAt && closedAt >= openedAt ? closedAt : null
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.openedAt - b.openedAt)
    : [];

const getSessionOverlapMinutes = ({ session, range, now }) => {
  const effectiveClose = session.closedAt
    ? new Date(Math.min(session.closedAt.getTime(), range.end.getTime()))
    : new Date(Math.min(now.getTime(), range.end.getTime()));
  const effectiveOpen = new Date(Math.max(session.openedAt.getTime(), range.start.getTime()));

  if (effectiveClose < effectiveOpen) {
    return 0;
  }

  return Math.max(0, Math.round((effectiveClose.getTime() - effectiveOpen.getTime() + 1) / 60000));
};

const normalizeChairSessions = (chairSessions = []) =>
  Array.isArray(chairSessions)
    ? chairSessions
        .map((session) => {
          const startedAt = getValidDate(session?.startedAt);
          const endedAt = session?.endedAt ? getValidDate(session.endedAt) : null;

          if (!startedAt) {
            return null;
          }

          return {
            startedAt,
            endedAt: endedAt && endedAt >= startedAt ? endedAt : null
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.startedAt - b.startedAt)
    : [];

const getChairSessionOverlapMinutes = ({ session, range, now }) => {
  const effectiveClose = session.endedAt
    ? new Date(Math.min(session.endedAt.getTime(), range.end.getTime()))
    : new Date(Math.min(now.getTime(), range.end.getTime()));
  const effectiveOpen = new Date(Math.max(session.startedAt.getTime(), range.start.getTime()));

  if (effectiveClose < effectiveOpen) {
    return 0;
  }

  return Math.max(0, Math.round((effectiveClose.getTime() - effectiveOpen.getTime() + 1) / 60000));
};

const getDateOverlapMinutes = ({ start, end, range }) => {
  const validStart = getValidDate(start);
  const validEnd = getValidDate(end);

  if (!validStart || !validEnd) {
    return 0;
  }

  const effectiveStart = new Date(Math.max(validStart.getTime(), range.start.getTime()));
  const effectiveEnd = new Date(Math.min(validEnd.getTime(), range.end.getTime()));

  if (effectiveEnd < effectiveStart) {
    return 0;
  }

  return Math.max(0, Math.round((effectiveEnd.getTime() - effectiveStart.getTime() + 1) / 60000));
};

const getBookingElapsedServiceMinutes = ({ booking, range, now = new Date() }) => {
  if (!booking || booking.status === "cancelled") {
    return 0;
  }

  const fallbackTotalTime = Math.max(0, Number(booking.totalTime || 0));
  const startAt = getValidDate(booking.actualStartTime) || getValidDate(booking.startTime);

  if (booking.status === "completed") {
    const completedAt = getValidDate(booking.completedAt);
    const rangedElapsed = getDateOverlapMinutes({
      start: startAt,
      end: completedAt,
      range
    });

    if (rangedElapsed > 0) {
      return rangedElapsed;
    }

    return fallbackTotalTime;
  }

  if (booking.status === "in-progress") {
    if (!startAt) {
      return 0;
    }

    const cappedEnd = fallbackTotalTime
      ? new Date(Math.min(now.getTime(), startAt.getTime() + fallbackTotalTime * 60000))
      : now;
    const rangedElapsed = getDateOverlapMinutes({
      start: startAt,
      end: cappedEnd,
      range
    });

    if (!fallbackTotalTime) {
      return rangedElapsed;
    }

    return Math.min(fallbackTotalTime, rangedElapsed);
  }

  return 0;
};

const getOpenRangeMinutes = ({
  shopSessions = [],
  range,
  now = new Date(),
  isOpen = false
}) => {
  const normalizedShopSessions = normalizeShopSessions(shopSessions);
  const overlappingShopSessions = normalizedShopSessions.filter((session) => {
    const sessionEnd = session.closedAt || now;
    return sessionEnd >= range.start && session.openedAt <= range.end;
  });
  const sessionOverlapMinutes = overlappingShopSessions.reduce(
    (sum, session) => sum + getSessionOverlapMinutes({ session, range, now }),
    0
  );

  if (sessionOverlapMinutes === 0) {
    if (!isOpen) {
      return 0;
    }

    const fallbackEnd = new Date(Math.min(now.getTime(), range.end.getTime()));

    if (fallbackEnd < range.start) {
      return 0;
    }

    return Math.max(0, Math.round((fallbackEnd.getTime() - range.start.getTime() + 1) / 60000));
  }

  if (
    !isOpen ||
    overlappingShopSessions.length !== 1 ||
    overlappingShopSessions[0].closedAt !== null ||
    overlappingShopSessions[0].openedAt <= range.start
  ) {
    return sessionOverlapMinutes;
  }

  const preludeEnd = new Date(overlappingShopSessions[0].openedAt.getTime() - 1);

  if (preludeEnd < range.start) {
    return sessionOverlapMinutes;
  }

  const preludeMinutes = Math.max(
    0,
    Math.round((preludeEnd.getTime() - range.start.getTime() + 1) / 60000)
  );

  return sessionOverlapMinutes + preludeMinutes;
};

const getChairOpenRangeMinutes = ({
  chairSessions = [],
  range,
  now = new Date(),
  isChairActive = false,
  shopOpenRangeMinutes = 0,
  shopSessions = [],
  isOpen = false
}) => {
  const normalizedChairSessions = normalizeChairSessions(chairSessions);
  const chairSessionOverlapMinutes = normalizedChairSessions.reduce(
    (sum, session) => sum + getChairSessionOverlapMinutes({ session, range, now }),
    0
  );

  if (!isChairActive && chairSessionOverlapMinutes === 0) {
    return 0;
  }

  if (chairSessionOverlapMinutes === 0) {
    return shopOpenRangeMinutes;
  }

  if (
    !isChairActive ||
    normalizedChairSessions.filter((session) => {
      const sessionEnd = session.endedAt || now;
      return sessionEnd >= range.start && session.startedAt <= range.end;
    }).length !== 1
  ) {
    return chairSessionOverlapMinutes;
  }

  const firstOverlappingSession = normalizedChairSessions.find((session) => {
    const sessionEnd = session.endedAt || now;
    return sessionEnd >= range.start && session.startedAt <= range.end;
  });

  if (
    !firstOverlappingSession ||
    firstOverlappingSession.endedAt !== null ||
    firstOverlappingSession.startedAt <= range.start
  ) {
    return chairSessionOverlapMinutes;
  }

  const preludeEnd = new Date(firstOverlappingSession.startedAt.getTime() - 1);

  if (preludeEnd < range.start) {
    return chairSessionOverlapMinutes;
  }

  const backfilledPreludeMinutes = getOpenRangeMinutes({
    shopSessions,
    range: {
      start: range.start,
      end: preludeEnd
    },
    now,
    isOpen
  });

  return chairSessionOverlapMinutes + backfilledPreludeMinutes;
};

const buildChairRevenueHistory = ({ bookings = [], legacyServiceMap = {} }) => {
  const historyByDate = bookings.reduce((map, booking) => {
    const eventDate = getBookingEventDate(booking);

    if (!eventDate) {
      return map;
    }

    const dateKey = eventDate.toISOString().slice(0, 10);
    const revenue = getBookingTotalPrice(booking, legacyServiceMap);

    if (!map[dateKey]) {
      map[dateKey] = {
        date: dateKey,
        revenue: 0,
        transactions: []
      };
    }

    map[dateKey].revenue += revenue;
    map[dateKey].transactions.push({
      bookingId: String(booking._id || ""),
      orderId: booking.orderId || "",
      customerName: booking.customerName || "Walk-in customer",
      services: booking.services || [],
      status: booking.status || "booked",
      revenue,
      eventTime: eventDate.toISOString()
    });

    return map;
  }, {});

  return Object.values(historyByDate)
    .map((group) => ({
      ...group,
      transactions: group.transactions.sort(
        (a, b) => new Date(a.eventTime) - new Date(b.eventTime) || a.customerName.localeCompare(b.customerName)
      )
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

const buildChairMetrics = ({
  chairs = [],
  bookings = [],
  range,
  shopSessions = [],
  now = new Date(),
  isOpen = false,
  legacyServiceMap = {}
}) => {
  const normalizedChairs = sanitizeChairs(chairs);
  const shopOpenRangeMinutes = getOpenRangeMinutes({ shopSessions, range, now, isOpen });
  const nonCancelledBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const assignedBookings = nonCancelledBookings.filter((booking) => booking.chairId);
  const unassignedRevenue = nonCancelledBookings
    .filter((booking) => !booking.chairId)
    .reduce((sum, booking) => sum + getBookingTotalPrice(booking, legacyServiceMap), 0);
  const metricsByChair = normalizedChairs.map((chair) => {
    const chairOpenRangeMinutes = getChairOpenRangeMinutes({
      chairSessions: chair.sessions,
      range,
      now,
      isChairActive: chair.isActive !== false,
      shopOpenRangeMinutes,
      shopSessions,
      isOpen
    });
    const chairBookings = assignedBookings.filter((booking) => String(booking.chairId) === String(chair.id));
    const totalServiceMinutes = chairBookings.reduce(
      (sum, booking) => sum + Math.max(0, Number(booking.totalTime || 0)),
      0
    );
    const elapsedServiceMinutes = chairBookings.reduce(
      (sum, booking) => sum + getBookingElapsedServiceMinutes({ booking, range, now }),
      0
    );
    const bookingCount = chairBookings.length;
    const averageServiceMinutes = bookingCount
      ? Number((totalServiceMinutes / bookingCount).toFixed(1))
      : 0;
    const estimatedRevenue = chairBookings.reduce(
      (sum, booking) => sum + getBookingTotalPrice(booking, legacyServiceMap),
      0
    );
    const completedRevenue = chairBookings
      .filter((booking) => booking.status === "completed")
      .reduce((sum, booking) => sum + getBookingTotalPrice(booking, legacyServiceMap), 0);
    const averageBookingValue = bookingCount
      ? Number((estimatedRevenue / bookingCount).toFixed(1))
      : 0;
    const revenuePerServiceHour = totalServiceMinutes
      ? Number((estimatedRevenue / (totalServiceMinutes / 60)).toFixed(1))
      : 0;
    const utilizationRate = chairOpenRangeMinutes
      ? Number((Math.min(100, (elapsedServiceMinutes / chairOpenRangeMinutes) * 100)).toFixed(1))
      : 0;
    const idleMinutes = Math.max(0, chairOpenRangeMinutes - elapsedServiceMinutes);

    return {
      chairId: chair.id,
      chairName: chair.name,
      isActive: chair.isActive !== false,
      bookingCount,
      totalServiceMinutes,
      averageServiceMinutes,
      estimatedRevenue,
      completedRevenue,
      averageBookingValue,
      revenuePerServiceHour,
      revenueHistory: buildChairRevenueHistory({
        bookings: chairBookings,
        legacyServiceMap
      }),
      utilizationRate,
      idleMinutes
    };
  });

  const busiestChair = metricsByChair
    .slice()
    .sort(
      (a, b) =>
        b.bookingCount - a.bookingCount ||
        b.totalServiceMinutes - a.totalServiceMinutes ||
        a.chairName.localeCompare(b.chairName)
    )[0] || null;
  const topRevenueChair = metricsByChair
    .slice()
    .sort(
      (a, b) =>
        b.estimatedRevenue - a.estimatedRevenue ||
        b.completedRevenue - a.completedRevenue ||
        a.chairName.localeCompare(b.chairName)
    )[0] || null;
  const totalChairRevenue = metricsByChair.reduce(
    (sum, chair) => sum + Number(chair.estimatedRevenue || 0),
    0
  );

  return {
    summary: {
      busiestChairId: busiestChair?.chairId || null,
      busiestChairName: busiestChair?.chairName || "No chair activity",
      busiestChairBookings: busiestChair?.bookingCount || 0,
      topRevenueChairId: topRevenueChair?.estimatedRevenue ? topRevenueChair.chairId : null,
      topRevenueChairName: topRevenueChair?.estimatedRevenue
        ? topRevenueChair.chairName
        : "No chair revenue",
      topRevenue: topRevenueChair?.estimatedRevenue || 0,
      totalChairRevenue,
      unassignedRevenue
    },
    perChair: metricsByChair
  };
};

const buildBarberMetrics = async ({ barberId, bookings, legacyServiceMap }) => {
  const serviceMap = legacyServiceMap || (await buildLegacyServicePriceMap(barberId));
  const nonCancelledBookings = bookings.filter((booking) => booking.status !== "cancelled");

  return {
    totalBookings: nonCancelledBookings.length,
    estimatedRevenue: nonCancelledBookings.reduce(
      (sum, booking) => sum + getBookingTotalPrice(booking, serviceMap),
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

const buildBarberOverviewMetrics = ({ barber, bookings, allBookings, range }) => {
  const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;

  return {
    shopOverview: {
      isOpen: Boolean(barber?.isOpen)
    },
    totalBookings: bookings.length,
    customerGrowth: buildCustomerGrowth({ bookings: allBookings, range }),
    cancellationRate: bookings.length
      ? Number(((cancelledBookings / bookings.length) * 100).toFixed(1))
      : 0
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
  const currentBarber = barbersById[String(barberId)];
  const allBarberBookings = allBookings.filter(
    (booking) => String(booking.barberId) === String(barberId)
  );
  const legacyServiceMap = await buildLegacyServicePriceMap(barberId);
  const platformMetrics = buildPlatformMetrics({
    bookings: filteredBookings,
    allBookings,
    barbersById,
    range
  });
  const barberOverviewMetrics = buildBarberOverviewMetrics({
    barber: currentBarber,
    bookings: barberBookings,
    allBookings: allBarberBookings,
    range
  });
  const chairMetrics = buildChairMetrics({
    chairs: currentBarber?.chairs || [],
    bookings: barberBookings,
    range,
    shopSessions: currentBarber?.shopSessions || [],
    now,
    isOpen: Boolean(currentBarber?.isOpen),
    legacyServiceMap
  });

  return {
    range: {
      preset: range.rangePreset,
      start: range.start.toISOString(),
      end: range.end.toISOString()
    },
    barberMetrics: await buildBarberMetrics({
      barberId,
      bookings: barberBookings,
      legacyServiceMap
    }),
    chairMetrics,
    barberOverviewMetrics,
    platformMetrics,
    topPerformingShops: platformMetrics.topPerformingShops
  };
};

module.exports = {
  buildBarberMetrics,
  buildBarberOverviewMetrics,
  buildChairMetrics,
  buildCustomerGrowth,
  buildPeakBookingHours,
  buildPlatformMetrics,
  buildServicePopularity,
  filterBookingsByRange,
  getAnalyticsOverview,
  getBookingEventDate,
  getBookingElapsedServiceMinutes,
  getChairOpenRangeMinutes,
  getOpenRangeMinutes,
  getRangeDurationMinutes,
  getRangeForPreset,
  getBookingRevenue: getBookingTotalPrice
};
