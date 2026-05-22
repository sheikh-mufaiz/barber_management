const Booking = require("../models/Booking");

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

const applySlot = (booking, startMs) => {
  const endMs = startMs + getDurationMs(booking);
  booking.startTime = new Date(startMs);
  booking.endTime = new Date(endMs);
  return endMs;
};

const isScheduledSlotAvailable = (bookings, scheduledStart, totalTime) => {
  const startMs = getDateValue(scheduledStart);
  const endMs = startMs + Math.max(0, Number(totalTime || 0)) * MINUTE;

  if (!startMs || endMs <= startMs) return false;

  return !bookings.some((booking) => {
    const bookingStartMs = getDateValue(booking.startTime);
    const bookingEndMs = getDateValue(booking.endTime);

    if (!bookingStartMs || !bookingEndMs) return false;

    return startMs < bookingEndMs && endMs > bookingStartMs;
  });
};

const arrangeBookings = (bookings, now = new Date()) => {
  const nowMs = now.getTime();
  const arranged = [];
  let cursor = nowMs;

  const inProgress = bookings
    .filter((booking) => booking.status === "in-progress")
    .sort((a, b) => getDateValue(a.actualStartTime) - getDateValue(b.actualStartTime));

  for (const booking of inProgress) {
    const startMs = getDateValue(booking.actualStartTime) || getDateValue(booking.startTime) || nowMs;
    const endMs = applySlot(booking, startMs);
    cursor = Math.max(cursor, endMs);
    arranged.push(booking);
  }

  const pending = bookings.filter((booking) => booking.status !== "in-progress");
  const scheduled = pending
    .filter((booking) => booking.bookingType === "scheduled")
    .sort(sortByScheduled);
  const instant = pending
    .filter((booking) => booking.bookingType !== "scheduled")
    .sort(sortByCreated);

  while (scheduled.length || instant.length) {
    const nextScheduled = scheduled[0];

    if (!nextScheduled) {
      const booking = instant.shift();
      cursor = applySlot(booking, cursor);
      arranged.push(booking);
      continue;
    }

    const scheduledStartMs = Math.max(
      cursor,
      getDateValue(nextScheduled.scheduledFor) || getDateValue(nextScheduled.startTime) || cursor
    );
    const instantFitIndex = instant.findIndex((booking) => {
      return cursor + getDurationMs(booking) <= scheduledStartMs;
    });

    if (instantFitIndex !== -1 && cursor <= scheduledStartMs) {
      const [booking] = instant.splice(instantFitIndex, 1);
      cursor = applySlot(booking, cursor);
      arranged.push(booking);
      continue;
    }

    const booking = scheduled.shift();
    cursor = applySlot(booking, scheduledStartMs);
    arranged.push(booking);
  }

  return arranged;
};

const recalculateQueueForBarber = async (barberId, now = new Date()) => {
  const bookings = await Booking.find({ barberId }).sort({ startTime: 1, createdAt: 1 });
  const arranged = arrangeBookings(bookings, now);

  for (const booking of arranged) {
    await booking.save();
  }

  return arranged;
};

const estimateBookingForBarber = async ({
  barberId,
  totalTime,
  bookingType = "instant",
  scheduledFor
}) => {
  const normalizedBookingType =
    bookingType === "scheduled" ? "scheduled" : "instant";
  const requestedScheduleTime = scheduledFor ? new Date(scheduledFor) : null;
  const numericTotalTime = Number(totalTime);
  const now = new Date();

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

    if (
      !isScheduledSlotAvailable(
        plainBookings,
        requestedScheduleTime,
        numericTotalTime
      )
    ) {
      return {
        available: false,
        message: "No slot available at this scheduled time"
      };
    }
  }

  const start =
    normalizedBookingType === "scheduled" ? requestedScheduleTime : now;
  const previewId = "__preview_booking__";
  const previewBooking = {
    _id: previewId,
    barberId,
    totalTime: numericTotalTime,
    bookingType: normalizedBookingType,
    scheduledFor:
      normalizedBookingType === "scheduled" ? requestedScheduleTime : null,
    startTime: start,
    endTime: new Date(start.getTime() + numericTotalTime * MINUTE),
    status: "booked",
    createdAt: now
  };

  const arranged = arrangeBookings([...plainBookings, previewBooking], now);
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
  estimateBookingForBarber,
  isScheduledSlotAvailable,
  recalculateQueueForBarber,
  recalculateAllQueues
};
