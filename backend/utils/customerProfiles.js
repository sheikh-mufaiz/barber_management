const Booking = require("../models/Booking");
const {
  buildLegacyServicePriceMap,
  getBookingServiceItems,
  getBookingTotalPrice
} = require("./bookingSnapshots");

const getBadgeForVisitCount = (visitCount) => {
  if (visitCount >= 6) {
    return "VIP";
  }

  if (visitCount >= 3) {
    return "Regular";
  }

  return "New";
};

const sortRecentBookings = (a, b) =>
  new Date(b.completedAt || b.cancelledAt || b.updatedAt || b.createdAt) -
  new Date(a.completedAt || a.cancelledAt || a.updatedAt || a.createdAt);

const createProfileSummary = ({
  customerId,
  customerName,
  barberId,
  completedBookings = [],
  recentBookings = [],
  legacyServiceMap = {}
}) => {
  const serviceCounts = {};

  completedBookings.forEach((booking) => {
    getBookingServiceItems(booking, legacyServiceMap).forEach((item) => {
      if (!item.name) {
        return;
      }

      serviceCounts[item.name] = (serviceCounts[item.name] || 0) + 1;
    });
  });

  const favoriteServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
  const visitCount = completedBookings.length;
  const totalSpend = completedBookings.reduce(
    (sum, booking) => sum + getBookingTotalPrice(booking, legacyServiceMap),
    0
  );

  return {
    barberId,
    customerId,
    customerName,
    visitCount,
    totalSpend,
    badge: getBadgeForVisitCount(visitCount),
    favoriteServices,
    topService: favoriteServices[0]?.name || null,
    recentBookings: recentBookings
      .slice()
      .sort(sortRecentBookings)
      .slice(0, 5)
      .map((booking) => ({
        _id: booking._id,
        orderId: booking.orderId,
        services: getBookingServiceItems(booking, legacyServiceMap).map((item) => item.name),
        serviceItems: getBookingServiceItems(booking, legacyServiceMap),
        totalPrice: getBookingTotalPrice(booking, legacyServiceMap),
        status: booking.status,
        chairName: booking.chairName,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }))
  };
};

const getCustomerProfile = async ({ barberId, customerId }) => {
  const bookings = await Booking.find({
    barberId,
    customerId,
    status: { $in: ["completed", "cancelled"] }
  }).sort({ createdAt: -1 });
  const legacyServiceMap = await buildLegacyServicePriceMap(barberId);
  const completedBookings = bookings.filter((booking) => booking.status === "completed");

  return createProfileSummary({
    customerId,
    customerName: bookings[0]?.customerName || "",
    barberId,
    completedBookings,
    recentBookings: bookings,
    legacyServiceMap
  });
};

const getCustomerProfilesForBarber = async ({ barberId }) => {
  const bookings = await Booking.find({
    barberId,
    status: { $in: ["completed", "cancelled"] }
  }).sort({ createdAt: -1 });
  const legacyServiceMap = await buildLegacyServicePriceMap(barberId);
  const grouped = new Map();

  bookings.forEach((booking) => {
    const customerKey = booking.customerId || booking.customerName || `guest-${booking._id}`;

    if (!grouped.has(customerKey)) {
      grouped.set(customerKey, []);
    }

    grouped.get(customerKey).push(booking);
  });

  return Array.from(grouped.entries())
    .map(([customerId, customerBookings]) =>
      createProfileSummary({
        customerId,
        customerName: customerBookings[0]?.customerName || "Walk-in customer",
        barberId,
        completedBookings: customerBookings.filter((booking) => booking.status === "completed"),
        recentBookings: customerBookings,
        legacyServiceMap
      })
    )
    .sort((a, b) => b.visitCount - a.visitCount || b.totalSpend - a.totalSpend);
};

module.exports = {
  buildLegacyServicePriceMap,
  createProfileSummary,
  getBadgeForVisitCount,
  getBookingServiceItems,
  getBookingTotalPrice,
  getCustomerProfile,
  getCustomerProfilesForBarber
};
