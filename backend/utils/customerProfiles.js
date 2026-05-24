const Booking = require("../models/Booking");
const Service = require("../models/Service");

const getBadgeForVisitCount = (visitCount) => {
  if (visitCount >= 6) {
    return "VIP";
  }

  if (visitCount >= 3) {
    return "Regular";
  }

  return "New";
};

const buildLegacyServicePriceMap = async (barberId) => {
  const services = await Service.find({ barberId });

  return services.reduce((map, service) => {
    map[service.name] = Number(service.price || 0);
    return map;
  }, {});
};

const getBookingServiceItems = (booking, legacyPriceMap = {}) => {
  if (Array.isArray(booking.serviceItems) && booking.serviceItems.length) {
    return booking.serviceItems.map((item) => ({
      name: item.name,
      duration: Number(item.duration || 0),
      price: Number(item.price || 0)
    }));
  }

  return (booking.services || []).map((serviceName) => ({
    name: serviceName,
    duration: 0,
    price: Number(legacyPriceMap[serviceName] || 0)
  }));
};

const getBookingTotalPrice = (booking, legacyPriceMap = {}) => {
  if (typeof booking.totalPrice === "number") {
    return Number(booking.totalPrice || 0);
  }

  return getBookingServiceItems(booking, legacyPriceMap).reduce(
    (sum, item) => sum + Number(item.price || 0),
    0
  );
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
  legacyPriceMap = {}
}) => {
  const serviceCounts = {};

  completedBookings.forEach((booking) => {
    getBookingServiceItems(booking, legacyPriceMap).forEach((item) => {
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
    (sum, booking) => sum + getBookingTotalPrice(booking, legacyPriceMap),
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
        services: booking.services || getBookingServiceItems(booking, legacyPriceMap).map((item) => item.name),
        totalPrice: getBookingTotalPrice(booking, legacyPriceMap),
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
  const legacyPriceMap = await buildLegacyServicePriceMap(barberId);
  const completedBookings = bookings.filter((booking) => booking.status === "completed");

  return createProfileSummary({
    customerId,
    customerName: bookings[0]?.customerName || "",
    barberId,
    completedBookings,
    recentBookings: bookings,
    legacyPriceMap
  });
};

const getCustomerProfilesForBarber = async ({ barberId }) => {
  const bookings = await Booking.find({
    barberId,
    status: { $in: ["completed", "cancelled"] }
  }).sort({ createdAt: -1 });
  const legacyPriceMap = await buildLegacyServicePriceMap(barberId);
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
        legacyPriceMap
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
