const MINUTE = 60000;
const ACTIVE_STATUSES = new Set(["booked", "in-progress"]);

const getTimeValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
};

export const formatNotificationToken = (orderId) => {
  if (!orderId) {
    return "Token pending";
  }

  return `Token #${String(orderId).slice(-4)}`;
};

const getWaitMinutes = (booking, now) => {
  if (booking.status === "in-progress" && booking.actualStartTime) {
    const elapsed = (now - getTimeValue(booking.actualStartTime)) / MINUTE;
    return Math.max(0, Math.floor((booking.totalTime || 0) - elapsed));
  }

  const startMs = getTimeValue(booking.startTime);
  if (!startMs) {
    return 0;
  }

  return Math.max(0, Math.floor((startMs - now) / MINUTE));
};

const formatExpectedTime = (value) => {
  const timeMs = getTimeValue(value);
  if (!timeMs) {
    return "--";
  }

  return new Date(timeMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const isActive = (booking) => ACTIVE_STATUSES.has(booking?.status);

const getChairLabel = (booking) => booking?.chairName || "the queue";

export const detectBookingNotifications = ({
  previousBookings = [],
  currentBookings = [],
  viewerRole,
  viewerUserId,
  nearTurnThreshold = 10,
  now = Date.now()
}) => {
  const previousMap = new Map(previousBookings.map((booking) => [booking._id, booking]));
  const notifications = [];

  currentBookings.forEach((booking) => {
    const previous = previousMap.get(booking._id);
    const token = formatNotificationToken(booking.orderId);
    const bookingName = booking.customerName || token;

    if (viewerRole === "customer" && booking.customerId !== viewerUserId) {
      return;
    }

    if (viewerRole === "barber" && String(booking.barberId) !== String(viewerUserId)) {
      return;
    }

    if (viewerRole === "barber" && !previous && isActive(booking)) {
      notifications.push({
        key: `new-${booking._id}`,
        title: "Booking Confirmed",
        message: `${token} for ${bookingName} joined ${getChairLabel(booking)}.`,
        variant: "success"
      });
    }

    if (!previous) {
      return;
    }

    if (previous.status !== "in-progress" && booking.status === "in-progress") {
      notifications.push({
        key: `started-${booking._id}`,
        title: "Service Started",
        message:
          viewerRole === "customer"
            ? `${token} is now in the chair at ${getChairLabel(booking)}.`
            : `${token} for ${bookingName} is now in progress at ${getChairLabel(booking)}.`,
        variant: "info"
      });
    }

    if (previous.status !== "completed" && booking.status === "completed") {
      notifications.push({
        key: `completed-${booking._id}`,
        title: "Booking Completed",
        message:
          viewerRole === "customer"
            ? `${token} has been completed.`
            : `${token} for ${bookingName} has been completed.`,
        variant: "success"
      });
    }

    const previousStartMs = getTimeValue(previous.startTime);
    const currentStartMs = getTimeValue(booking.startTime);
    const startShiftMs = Math.abs(currentStartMs - previousStartMs);

    if (
      isActive(previous) &&
      isActive(booking) &&
      previousStartMs &&
      currentStartMs &&
      startShiftMs >= MINUTE
    ) {
      notifications.push({
        key: `shift-${booking._id}-${currentStartMs}`,
        title: "Schedule Changed",
        message:
          viewerRole === "customer"
            ? `${token} is now expected at ${formatExpectedTime(booking.startTime)}.`
            : `${token} for ${bookingName} moved to ${formatExpectedTime(booking.startTime)}.`,
        variant: "update"
      });
    }

    if (viewerRole === "customer" && isActive(booking)) {
      const previousWait = getWaitMinutes(previous, now);
      const currentWait = getWaitMinutes(booking, now);

      if (previousWait > nearTurnThreshold && currentWait <= nearTurnThreshold) {
        notifications.push({
          key: `near-${booking._id}-${nearTurnThreshold}`,
          title: "Your Turn Is Near",
          message: `${token} is about ${currentWait} mins away at ${getChairLabel(booking)}.`,
          variant: "warning"
        });
      }
    }
  });

  return notifications;
};
