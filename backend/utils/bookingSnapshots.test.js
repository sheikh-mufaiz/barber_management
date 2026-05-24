const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const Service = require("../models/Service");
const {
  backfillLegacyBookingSnapshots,
  buildBookingServiceSnapshot,
  getBookingServiceItems,
  getBookingTotalDuration,
  getBookingTotalPrice,
  validateBookingServiceSnapshot
} = require("./bookingSnapshots");

test("builds an ordered booking snapshot and preserves duplicates", () => {
  const snapshot = buildBookingServiceSnapshot({
    services: ["Haircut", "Wax", "Haircut"],
    serviceMap: {
      Haircut: { name: "Haircut", duration: 15, price: 100 },
      Wax: { name: "Wax", duration: 10, price: 50 }
    }
  });

  assert.deepEqual(snapshot, [
    { name: "Haircut", duration: 15, price: 100 },
    { name: "Wax", duration: 10, price: 50 },
    { name: "Haircut", duration: 15, price: 100 }
  ]);
});

test("validates missing services before saving a booking snapshot", () => {
  const validation = validateBookingServiceSnapshot({
    requestedServices: ["Haircut", "Unknown"],
    serviceMap: {
      Haircut: { name: "Haircut", duration: 15, price: 100 }
    }
  });

  assert.equal(validation.hasMissingServices, true);
  assert.deepEqual(validation.missingServices, ["Unknown"]);
});

test("prefers stored snapshot totals over legacy catalog prices", () => {
  const booking = {
    services: ["Haircut"],
    serviceItems: [{ name: "Haircut", duration: 15, price: 100 }],
    totalPrice: 100
  };

  assert.equal(getBookingTotalPrice(booking, { Haircut: 300 }), 100);
  assert.equal(getBookingTotalDuration(booking, { Haircut: 300 }), 15);
  assert.deepEqual(getBookingServiceItems(booking, { Haircut: 300 }), [
    { name: "Haircut", duration: 15, price: 100 }
  ]);
});

test("falls back to legacy service map for unsnapped bookings", () => {
  const booking = {
    services: ["Wax"]
  };

  assert.deepEqual(getBookingServiceItems(booking, { Wax: 50 }), [
    { name: "Wax", duration: 0, price: 50 }
  ]);
  assert.equal(getBookingTotalPrice(booking, { Wax: 50 }), 50);
});

test("backfills only missing snapshot fields for legacy bookings", async () => {
  const bookingFind = Booking.find;
  const bulkWrite = Booking.bulkWrite;
  const serviceFind = Service.find;

  Booking.find = () => ({
    sort: async () => [
      {
        _id: "legacy-booking",
        barberId: "barber-1",
        services: ["Haircut", "Wax"],
        serviceItems: [],
        totalPrice: undefined
      },
      {
        _id: "keep-existing",
        barberId: "barber-1",
        services: ["Haircut"],
        serviceItems: [{ name: "Haircut", duration: 15, price: 100 }],
        totalPrice: 100
      },
      {
        _id: "missing-total-only",
        barberId: "barber-2",
        services: ["Beard"],
        serviceItems: [{ name: "Beard", duration: 20, price: 80 }],
        totalPrice: undefined
      }
    ]
  });
  Service.find = async ({ barberId }) =>
    barberId === "barber-1"
      ? [
          { name: "Haircut", duration: 15, price: 100 },
          { name: "Wax", duration: 10, price: 50 }
        ]
      : [{ name: "Beard", duration: 20, price: 80 }];

  let capturedOps = [];
  Booking.bulkWrite = async (ops) => {
    capturedOps = ops;
    return { modifiedCount: ops.length };
  };

  try {
    const result = await backfillLegacyBookingSnapshots();

    assert.equal(result.updated, 2);
    assert.equal(capturedOps.length, 2);
    assert.deepEqual(capturedOps[0].updateOne.update.$set, {
      serviceItems: [
        { name: "Haircut", duration: 15, price: 100 },
        { name: "Wax", duration: 10, price: 50 }
      ],
      totalPrice: 150
    });
    assert.deepEqual(capturedOps[1].updateOne.update.$set, {
      totalPrice: 80
    });
  } finally {
    Booking.find = bookingFind;
    Booking.bulkWrite = bulkWrite;
    Service.find = serviceFind;
  }
});
