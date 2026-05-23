const Booking = require("../models/Booking");
const User = require("../models/User");
const { findChairById, getActiveChairs, sanitizeChairs } = require("./chairs");

const ALLOWED_SCHEDULE_DELAY_MINUTES = 5;
const MINUTE = 60000;

const getDateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
};

const getCreatedValue = (booking) => {
  return getDateValue(booking.createdAt) || getDateValue(booking._id?.getTimestamp?.()) || 0;
};

const getDurationMs = (booking) => {
  return Math.max(0, Number(booking.totalTime || 0)) * MINUTE;
};

const sortByCreated = (a, b) => {
  return getCreatedValue(a) - getCreatedValue(b);
};

const sortByScheduled = (a, b) => {
  const aTime = getDateValue(a.scheduledFor) || getDateValue(a.startTime);
  const bTime = getDateValue(b.scheduledFor) || getDateValue(b.startTime);
  return aTime - bTime || sortByCreated(a, b);
};

const applySlot = (booking, startMs, chair) => {
  const endMs = startMs + getDurationMs(booking);
  booking.startTime = new Date(startMs);
  booking.endTime = new Date(endMs);
  if (chair) {
    booking.chairId = chair.id;
    booking.chairName = chair.name;
  }
  return endMs;
};

const sortIntervals = (intervals) =>
  intervals.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

const ensureReservationBucket = (reservations, chair) => {
  if (!reservations.has(chair.id)) {
    reservations.set(chair.id, []);
  }

  return reservations.get(chair.id);
};

const reserveSlot = (reservations, chair, booking, startMs) => {
  const endMs = applySlot(booking, startMs, chair);
  const intervals = ensureReservationBucket(reservations, chair);

  intervals.push({
    startMs,
    endMs,
    bookingId: String(booking._id)
  });
  sortIntervals(intervals);
  return endMs;
};

const findEarliestAvailableSlot = (intervals, durationMs, floorMs) => {
  let cursor = floorMs;

  for (const interval of sortIntervals([...intervals])) {
    if (cursor + durationMs <= interval.startMs) {
      return cursor;
    }

    if (cursor < interval.endMs) {
      cursor = interval.endMs;
    }
  }

  return cursor;
};

const resolveInProgressChair = ({
  booking,
  chairs,
  activeChairs,
  reservations,
  nowMs
}) => {
  const savedChair =
    findChairById(chairs, booking.chairId) ||
    (booking.chairName
      ? {
          id: booking.chairId || `legacy-chair-${String(booking._id)}`,
          name: booking.chairName,
          isActive: false
        }
      : null);

  if (savedChair) {
    return savedChair;
  }

  if (!activeChairs.length) {
    return {
      id: `legacy-chair-${String(booking._id)}`,
      name: "Unavailable Chair",
      isActive: false
    };
  }

  return activeChairs
    .map((chair) => {
      const intervals = ensureReservationBucket(reservations, chair);
      const latestEnd = intervals.length
        ? Math.max(...intervals.map((interval) => interval.endMs))
        : nowMs;

      return { chair, latestEnd };
    })
    .sort((a, b) => a.latestEnd - b.latestEnd)[0].chair;
};

const chooseChairForBooking = (chairs, reservations, durationMs, floorMs) =>
  chairs
    .map((chair) => {
      const intervals = ensureReservationBucket(reservations, chair);
      const startMs = findEarliestAvailableSlot(intervals, durationMs, floorMs);

      return { chair, startMs };
    })
    .sort((a, b) => a.startMs - b.startMs || a.chair.name.localeCompare(b.chair.name))[0] ||
  null;

const chooseRequestedChairForBooking = (
  requestedChairId,
  chairs,
  reservations,
  durationMs,
  floorMs
) => {
  const requestedChair = chairs.find((chair) => chair.id === requestedChairId);

  if (!requestedChair) {
    return null;
  }

  const intervals = ensureReservationBucket(reservations, requestedChair);
  const startMs = findEarliestAvailableSlot(intervals, durationMs, floorMs);

  return {
    chair: requestedChair,
    startMs
  };
};

const cloneBookings = (bookings = []) =>
  bookings.map((booking) => ({
    ...booking,
    services: Array.isArray(booking.services) ? [...booking.services] : booking.services
  }));

const buildReservedIntervalsByChair = (bookings, chairsInput, now = new Date()) => {
  const chairs = sanitizeChairs(chairsInput);
  const arranged = arrangeBookings(cloneBookings(bookings), chairs, now);
  const reservations = new Map();

  for (const booking of arranged) {
    const chairId = booking.chairId;
    const startMs = getDateValue(booking.startTime);
    const endMs = getDateValue(booking.endTime) || startMs + getDurationMs(booking);

    if (!chairId || !startMs || !endMs) {
      continue;
    }

    if (!reservations.has(chairId)) {
      reservations.set(chairId, []);
    }

    reservations.get(chairId).push({
      bookingId: String(booking._id),
      startMs,
      endMs
    });
  }

  for (const intervals of reservations.values()) {
    sortIntervals(intervals);
  }

  return reservations;
};

const isWindowAvailable = (intervals, startMs, endMs) =>
  !intervals.some((interval) => startMs < interval.endMs && endMs > interval.startMs);

const findScheduledChairAvailability = ({
  bookings,
  chairsInput,
  scheduledStart,
  totalTime,
  requestedChairId = null,
  now = new Date()
}) => {
  const startMs = getDateValue(scheduledStart);
  const chairs = sanitizeChairs(chairsInput);
  const activeChairs = getActiveChairs(chairs);
  const durationMs = Math.max(0, Number(totalTime || 0)) * MINUTE;

  if (!startMs || durationMs <= 0 || !activeChairs.length) {
    return {
      available: false,
      message: "No active chairs available right now"
    };
  }

  const requestedChair = requestedChairId
    ? activeChairs.find((chair) => chair.id === requestedChairId) || null
    : null;

  if (requestedChairId && !requestedChair) {
    return {
      available: false,
      message: "Selected chair is not available"
    };
  }

  const endMs = startMs + durationMs;
  const reservations = buildReservedIntervalsByChair(bookings, chairs, now);
  const chairsToCheck = requestedChair ? [requestedChair] : activeChairs;
  const availableChair = chairsToCheck.find((chair) =>
    isWindowAvailable(reservations.get(chair.id) || [], startMs, endMs)
  );

  if (!availableChair) {
    return {
      available: false,
      message: "Requested scheduled slot is already reserved by the current queue"
    };
  }

  return {
    available: true,
    chairId: availableChair.id,
    chairName: availableChair.name,
    estimatedStartTime: new Date(startMs),
    estimatedEndTime: new Date(endMs)
  };
};

const arrangeBookings = (bookings, chairsInput, now = new Date()) => {
  const chairs = sanitizeChairs(chairsInput);
  const activeChairs = getActiveChairs(chairs);
  const nowMs = now.getTime();
  const reservations = new Map();
  const arranged = [];

  const inProgress = bookings
    .filter((booking) => booking.status === "in-progress")
    .sort((a, b) => getDateValue(a.actualStartTime) - getDateValue(b.actualStartTime));

  for (const booking of inProgress) {
    const chair = resolveInProgressChair({
      booking,
      chairs,
      activeChairs,
      reservations,
      nowMs
    });
    const startMs =
      getDateValue(booking.actualStartTime) ||
      getDateValue(booking.startTime) ||
      nowMs;

    reserveSlot(reservations, chair, booking, startMs);
    arranged.push(booking);
  }

  if (!activeChairs.length) {
    const pendingWithoutCapacity = bookings.filter(
      (booking) => booking.status !== "in-progress"
    );

    return [...arranged, ...pendingWithoutCapacity].sort(
      (a, b) => getDateValue(a.startTime) - getDateValue(b.startTime) || sortByCreated(a, b)
    );
  }

  const pending = bookings.filter((booking) => booking.status !== "in-progress");
  const scheduled = pending
    .filter((booking) => booking.bookingType === "scheduled")
    .sort(sortByScheduled);
  const instant = pending
    .filter((booking) => booking.bookingType !== "scheduled")
    .sort(sortByCreated);

  for (const booking of scheduled) {
    const durationMs = getDurationMs(booking);
    const requestedMs =
      getDateValue(booking.scheduledFor) ||
      getDateValue(booking.startTime) ||
      nowMs;
    const selected = booking.chairId
      ? chooseRequestedChairForBooking(
          booking.chairId,
          activeChairs,
          reservations,
          durationMs,
          requestedMs
        )
      : chooseChairForBooking(
          activeChairs,
          reservations,
          durationMs,
          requestedMs
        );

    if (!selected) {
      arranged.push(booking);
      continue;
    }

    reserveSlot(reservations, selected.chair, booking, selected.startMs);
    arranged.push(booking);
  }

  for (const booking of instant) {
    const durationMs = getDurationMs(booking);
    const selected = chooseChairForBooking(
      activeChairs,
      reservations,
      durationMs,
      nowMs
    );

    if (!selected) {
      arranged.push(booking);
      continue;
    }

    reserveSlot(reservations, selected.chair, booking, selected.startMs);
    arranged.push(booking);
  }

  return arranged.sort(
    (a, b) => getDateValue(a.startTime) - getDateValue(b.startTime) || sortByCreated(a, b)
  );
};

const isScheduledSlotAvailable = (
  bookings,
  chairsInput,
  scheduledStart,
  totalTime,
  requestedChairId = null,
  now = new Date()
) =>
  findScheduledChairAvailability({
    bookings,
    chairsInput,
    scheduledStart,
    totalTime,
    requestedChairId,
    now
  }).available;

const recalculateQueueForBarber = async (barberId, now = new Date()) => {
  const barber = await User.findById(barberId);
  const bookings = await Booking.find({ barberId }).sort({ startTime: 1, createdAt: 1 });
  const arranged = arrangeBookings(bookings, barber?.chairs, now);

  for (const booking of arranged) {
    await booking.save();
  }

  return arranged;
};

const estimateBookingForBarber = async ({
  barberId,
  totalTime,
  bookingType = "instant",
  scheduledFor,
  requestedChairId
}) => {
  const normalizedBookingType =
    bookingType === "scheduled" ? "scheduled" : "instant";
  const requestedScheduleTime = scheduledFor ? new Date(scheduledFor) : null;
  const numericTotalTime = Number(totalTime);
  const now = new Date();
  const barber = await User.findById(barberId);
  const chairs = sanitizeChairs(barber?.chairs);
  const activeChairs = getActiveChairs(chairs);
  const requestedChair =
    normalizedBookingType === "scheduled" && requestedChairId
      ? activeChairs.find((chair) => chair.id === requestedChairId) || null
      : null;

  if (!activeChairs.length) {
    return {
      available: false,
      message: "No active chairs available right now"
    };
  }

  const existingBookings = await Booking.find({ barberId }).sort({
    startTime: 1,
    createdAt: 1
  });

  const plainBookings = existingBookings.map((booking) => booking.toObject());

  if (normalizedBookingType === "scheduled") {
    if (!requestedScheduleTime || isNaN(requestedScheduleTime.getTime())) {
      return {
        available: false,
        message: "Please select a valid scheduled time"
      };
    }

    if (requestedScheduleTime <= now) {
      return {
        available: false,
        message: "Scheduled time must be in the future"
      };
    }

    if (requestedChairId && !requestedChair) {
      return {
        available: false,
        message: "Selected chair is not available"
      };
    }

    const scheduledAvailability = findScheduledChairAvailability({
      bookings: plainBookings,
      chairsInput: chairs,
      scheduledStart: requestedScheduleTime,
      totalTime: numericTotalTime,
      requestedChairId,
      now
    });

    if (!scheduledAvailability.available) {
      return scheduledAvailability;
    }

    return {
      available: true,
      estimatedStartTime: scheduledAvailability.estimatedStartTime,
      estimatedEndTime: scheduledAvailability.estimatedEndTime,
      chairId: scheduledAvailability.chairId,
      chairName: scheduledAvailability.chairName,
      waitMinutes: Math.max(
        0,
        Math.floor((scheduledAvailability.estimatedStartTime.getTime() - now.getTime()) / MINUTE)
      )
    };
  }

  const start = now;
  const previewId = "__preview_booking__";
  const previewBooking = {
    _id: previewId,
    barberId,
    totalTime: numericTotalTime,
    bookingType: normalizedBookingType,
    scheduledFor: null,
    chairId: null,
    chairName: null,
    startTime: start,
    endTime: new Date(start.getTime() + numericTotalTime * MINUTE),
    status: "booked",
    createdAt: now
  };

  const arranged = arrangeBookings([...plainBookings, previewBooking], chairs, now);
  const estimatedBooking = arranged.find((booking) => booking._id === previewId);

  if (!estimatedBooking) {
    return {
      available: false,
      message: "Could not estimate booking time"
    };
  }

  const estimatedStartTime = new Date(estimatedBooking.startTime);
  const estimatedEndTime = new Date(estimatedBooking.endTime);

  return {
    available: true,
    estimatedStartTime,
    estimatedEndTime,
    chairId: estimatedBooking.chairId,
    chairName: estimatedBooking.chairName,
    waitMinutes: Math.max(
      0,
      Math.floor((estimatedStartTime.getTime() - now.getTime()) / MINUTE)
    )
  };
};

const recalculateAllQueues = async () => {
  const barberIds = await Booking.distinct("barberId");

  for (const barberId of barberIds) {
    await recalculateQueueForBarber(barberId);
  }
};

module.exports = {
  ALLOWED_SCHEDULE_DELAY_MINUTES,
  arrangeBookings,
  buildReservedIntervalsByChair,
  estimateBookingForBarber,
  findScheduledChairAvailability,
  isScheduledSlotAvailable,
  recalculateQueueForBarber,
  recalculateAllQueues
};
