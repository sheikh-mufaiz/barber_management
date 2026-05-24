const Booking = require("../models/Booking");
const Service = require("../models/Service");

const normalizeSnapshotItem = (item = {}) => ({
  name: item.name || "",
  duration: Number(item.duration || 0),
  price: Number(item.price || 0)
});

const getServiceSnapshotSource = (serviceMap = {}, serviceName) => {
  const matchedService = serviceMap[serviceName];

  if (typeof matchedService === "number") {
    return {
      name: serviceName,
      duration: 0,
      price: Number(matchedService || 0)
    };
  }

  return matchedService || null;
};

const buildLegacyServicePriceMap = async (barberId) => {
  const services = await Service.find({ barberId });

  return services.reduce((map, service) => {
    map[service.name] = {
      name: service.name,
      duration: Number(service.duration || 0),
      price: Number(service.price || 0)
    };
    return map;
  }, {});
};

const buildBookingServiceSnapshot = ({ services = [], serviceMap = {} }) =>
  (services || []).map((serviceName) => {
    const matchedService = getServiceSnapshotSource(serviceMap, serviceName);

    return normalizeSnapshotItem({
      name: serviceName,
      duration: matchedService?.duration,
      price: matchedService?.price
    });
  });

const validateBookingServiceSnapshot = ({ requestedServices = [], serviceMap = {} }) => {
  const missingServices = (requestedServices || []).filter(
    (serviceName) => !getServiceSnapshotSource(serviceMap, serviceName)
  );

  return {
    missingServices,
    hasMissingServices: missingServices.length > 0
  };
};

const getBookingServiceItems = (booking, legacyServiceMap = {}) => {
  if (Array.isArray(booking.serviceItems) && booking.serviceItems.length) {
    return booking.serviceItems.map((item) => normalizeSnapshotItem(item));
  }

  return buildBookingServiceSnapshot({
    services: booking.services || [],
    serviceMap: legacyServiceMap
  });
};

const getBookingTotalPrice = (booking, legacyServiceMap = {}) => {
  if (typeof booking.totalPrice === "number") {
    return Number(booking.totalPrice || 0);
  }

  return getBookingServiceItems(booking, legacyServiceMap).reduce(
    (sum, item) => sum + Number(item.price || 0),
    0
  );
};

const getBookingTotalDuration = (booking, legacyServiceMap = {}) => {
  const snapshotItems = getBookingServiceItems(booking, legacyServiceMap);

  return snapshotItems.reduce((sum, item) => sum + Number(item.duration || 0), 0);
};

const needsSnapshotBackfill = (booking) =>
  !Array.isArray(booking.serviceItems) || booking.serviceItems.length === 0 || typeof booking.totalPrice !== "number";

const backfillLegacyBookingSnapshots = async () => {
  const bookings = await Booking.find().sort({ createdAt: 1 });
  const serviceMapsByBarber = new Map();
  const bulkOps = [];

  for (const booking of bookings) {
    if (!needsSnapshotBackfill(booking)) {
      continue;
    }

    const barberKey = String(booking.barberId || "");

    if (!serviceMapsByBarber.has(barberKey)) {
      serviceMapsByBarber.set(barberKey, await buildLegacyServicePriceMap(barberKey));
    }

    const legacyServiceMap = serviceMapsByBarber.get(barberKey);
    const snapshotItems = getBookingServiceItems(booking, legacyServiceMap);
    const update = {};

    if (!Array.isArray(booking.serviceItems) || booking.serviceItems.length === 0) {
      update.serviceItems = snapshotItems;
    }

    if (typeof booking.totalPrice !== "number") {
      update.totalPrice = getBookingTotalPrice(booking, legacyServiceMap);
    }

    if (Object.keys(update).length) {
      bulkOps.push({
        updateOne: {
          filter: { _id: booking._id },
          update: { $set: update }
        }
      });
    }
  }

  if (!bulkOps.length) {
    return {
      scanned: bookings.length,
      updated: 0
    };
  }

  const result = await Booking.bulkWrite(bulkOps);

  return {
    scanned: bookings.length,
    updated: result.modifiedCount || bulkOps.length
  };
};

module.exports = {
  backfillLegacyBookingSnapshots,
  buildBookingServiceSnapshot,
  buildLegacyServicePriceMap,
  getBookingServiceItems,
  getBookingTotalDuration,
  getBookingTotalPrice,
  needsSnapshotBackfill,
  normalizeSnapshotItem,
  validateBookingServiceSnapshot
};
