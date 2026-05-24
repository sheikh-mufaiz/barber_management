export const getBookingServiceItems = (booking = {}) => {
  if (Array.isArray(booking.serviceItems) && booking.serviceItems.length) {
    return booking.serviceItems.map((item) => ({
      name: item.name || "",
      duration: Number(item.duration || 0),
      price: Number(item.price || 0)
    }));
  }

  return (booking.services || []).map((serviceName) => ({
    name: serviceName,
    duration: 0,
    price: 0
  }));
};

export const getBookingServiceNames = (booking = {}) =>
  getBookingServiceItems(booking)
    .map((item) => item.name)
    .filter(Boolean);

export const getBookingTotalPrice = (booking = {}) => {
  if (typeof booking.totalPrice === "number") {
    return Number(booking.totalPrice || 0);
  }

  return getBookingServiceItems(booking).reduce(
    (sum, item) => sum + Number(item.price || 0),
    0
  );
};
