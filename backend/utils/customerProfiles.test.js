const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const Service = require("../models/Service");
const {
  getBadgeForVisitCount,
  getBookingServiceItems,
  getBookingTotalPrice,
  getCustomerProfile,
  getCustomerProfilesForBarber
} = require("./customerProfiles");

const makeBooking = (overrides = {}) => ({
  _id: overrides._id || `booking-${Math.random()}`,
  barberId: "barber-1",
  customerId: "customer-1",
  customerName: "Aman",
  services: ["Haircut"],
  serviceItems: [{ name: "Haircut", duration: 15, price: 100 }],
  totalPrice: 100,
  status: "completed",
  completedAt: new Date("2026-05-24T10:20:00.000Z"),
  createdAt: new Date("2026-05-24T10:00:00.000Z"),
  updatedAt: new Date("2026-05-24T10:20:00.000Z"),
  ...overrides
});

test("maps visit counts to the expected loyalty badges", () => {
  assert.equal(getBadgeForVisitCount(0), "New");
  assert.equal(getBadgeForVisitCount(3), "Regular");
  assert.equal(getBadgeForVisitCount(6), "VIP");
});

test("falls back to legacy service prices when bookings predate snapshots", () => {
  const booking = makeBooking({
    serviceItems: [],
    totalPrice: undefined,
    services: ["Wax"]
  });

  assert.deepEqual(getBookingServiceItems(booking, { Wax: 50 }), [
    { name: "Wax", duration: 0, price: 50 }
  ]);
  assert.equal(getBookingTotalPrice(booking, { Wax: 50 }), 50);
});

test("builds a customer profile from completed bookings only", async () => {
  const bookingFind = Booking.find;
  const serviceFind = Service.find;

  Booking.find = () => ({
    sort: async () => [
      makeBooking({
        _id: "completed-1",
        services: ["Haircut"],
        serviceItems: [{ name: "Haircut", duration: 15, price: 100 }],
        totalPrice: 100
      }),
      makeBooking({
        _id: "completed-2",
        services: ["Haircut", "Wax"],
        serviceItems: [
          { name: "Haircut", duration: 15, price: 100 },
          { name: "Wax", duration: 10, price: 50 }
        ],
        totalPrice: 150
      }),
      makeBooking({
        _id: "cancelled-1",
        status: "cancelled",
        services: ["Beard"],
        serviceItems: [{ name: "Beard", duration: 10, price: 80 }],
        totalPrice: 80,
        completedAt: undefined,
        cancelledAt: new Date("2026-05-24T09:00:00.000Z")
      })
    ]
  });
  Service.find = async () => [];

  try {
    const profile = await getCustomerProfile({
      barberId: "barber-1",
      customerId: "customer-1"
    });

    assert.equal(profile.visitCount, 2);
    assert.equal(profile.totalSpend, 250);
    assert.equal(profile.badge, "New");
    assert.equal(profile.topService, "Haircut");
    assert.equal(profile.favoriteServices[0].count, 2);
    assert.equal(profile.recentBookings.length, 3);
  } finally {
    Booking.find = bookingFind;
    Service.find = serviceFind;
  }
});

test("keeps customer loyalty scoped per barber and customer", async () => {
  const bookingFind = Booking.find;
  const serviceFind = Service.find;

  Booking.find = () => ({
    sort: async () => [
      makeBooking({
        _id: "aman-1",
        customerId: "customer-1",
        customerName: "Aman",
        totalPrice: 100
      }),
      makeBooking({
        _id: "aman-2",
        customerId: "customer-1",
        customerName: "Aman",
        totalPrice: 100
      }),
      makeBooking({
        _id: "riya-1",
        customerId: "customer-2",
        customerName: "Riya",
        totalPrice: 150,
        services: ["Wax"],
        serviceItems: [{ name: "Wax", duration: 10, price: 150 }]
      })
    ]
  });
  Service.find = async () => [];

  try {
    const profiles = await getCustomerProfilesForBarber({ barberId: "barber-1" });

    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].customerName, "Aman");
    assert.equal(profiles[0].visitCount, 2);
    assert.equal(profiles[1].customerName, "Riya");
    assert.equal(profiles[1].totalSpend, 150);
  } finally {
    Booking.find = bookingFind;
    Service.find = serviceFind;
  }
});
