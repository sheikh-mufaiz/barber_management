import { formatNotificationToken } from "./bookingNotifications";
import { getBookingServiceNames } from "./bookingSnapshots";

export const getHistoryEventDate = (booking = {}) => {
  const value =
    booking.completedAt || booking.cancelledAt || booking.updatedAt || booking.createdAt || null;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const matchesDateRange = (booking, startDate, endDate) => {
  const eventDate = getHistoryEventDate(booking);

  if (!eventDate) {
    return false;
  }

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (eventDate < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (eventDate > end) {
      return false;
    }
  }

  return true;
};

export const compareHistoryBookings = (a, b) => {
  const aDate = getHistoryEventDate(a);
  const bDate = getHistoryEventDate(b);
  return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
};

export const filterHistoryBookings = (
  bookings = [],
  { searchQuery = "", statusFilter = "all", startDate = "", endDate = "", includeCustomerName = false } = {}
) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return bookings
    .filter((booking) => {
      if (statusFilter !== "all" && booking.status !== statusFilter) {
        return false;
      }

      if (!matchesDateRange(booking, startDate, endDate)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const fields = [
        ...(includeCustomerName ? [booking.customerName || ""] : []),
        ...getBookingServiceNames(booking),
        booking.orderId || "",
        formatNotificationToken(booking.orderId)
      ];

      return fields.some((field) => String(field).toLowerCase().includes(normalizedQuery));
    })
    .slice()
    .sort(compareHistoryBookings);
};
