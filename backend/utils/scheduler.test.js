const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const User = require("../models/User");
const {
  arrangeBookings,
  estimateBookingForBarber,
  findScheduledChairAvailability,
  isScheduledSlotAvailable
} = require("./scheduler");

const chairs = [
  { id: "chair-1", name: "Chair 1", isActive: true },
  { id: "chair-2", name: "Chair 2", isActive: true }
];

const oneChair = [{ id: "chair-1", name: "Chair 1", isActive: true }];
const now = new Date("2026-05-23T10:00:00.000Z");

const makeBooking = (overrides = {}) => ({
  _id: overrides._id || `booking-${Math.random()}`,
  barberId: "barber-1",
  totalTime: 15,
  bookingType: "instant",
  scheduledFor: null,
  startTime: new Date("2026-05-23T10:00:00.000Z"),
  endTime: new Date("2026-05-23T10:15:00.000Z"),
  status: "booked",
  chairId: "chair-1",
  chairName: "Chair 1",
  createdAt: new Date("2026-05-23T09:55:00.000Z"),
  ...overrides
});

test("rejects a scheduled booking that overlaps an in-progress booking on the same chair", () => {
  const bookings = [
    makeBooking({
      _id: "in-progress",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    })
  ];

  const available = isScheduledSlotAvailable(
    bookings,
    oneChair,
    new Date("2026-05-23T10:10:00.000Z"),
    10,
    "chair-1",
    now
  );

  assert.equal(available, false);
});

test("rejects a scheduled booking that takes time already reserved for a waiting instant booking", () => {
  const bookings = [
    makeBooking({
      _id: "in-progress",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    }),
    makeBooking({
      _id: "waiting",
      startTime: new Date("2026-05-23T10:20:00.000Z"),
      endTime: new Date("2026-05-23T10:35:00.000Z"),
      createdAt: new Date("2026-05-23T09:56:00.000Z")
    })
  ];

  const available = isScheduledSlotAvailable(
    bookings,
    oneChair,
    new Date("2026-05-23T10:25:00.000Z"),
    10,
    "chair-1",
    now
  );

  assert.equal(available, false);
});

test("accepts a scheduled booking when the requested window is truly free", () => {
  const bookings = [
    makeBooking({
      _id: "in-progress",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    }),
    makeBooking({
      _id: "waiting",
      startTime: new Date("2026-05-23T10:20:00.000Z"),
      endTime: new Date("2026-05-23T10:35:00.000Z"),
      createdAt: new Date("2026-05-23T09:56:00.000Z")
    })
  ];

  const available = isScheduledSlotAvailable(
    bookings,
    oneChair,
    new Date("2026-05-23T10:35:00.000Z"),
    10,
    "chair-1",
    now
  );

  assert.equal(available, true);
});

test("accepts a scheduled booking on another free chair without shifting the queue", () => {
  const bookings = [
    makeBooking({
      _id: "chair-1-live",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    })
  ];

  const result = findScheduledChairAvailability({
    bookings,
    chairsInput: chairs,
    scheduledStart: new Date("2026-05-23T10:05:00.000Z"),
    totalTime: 10,
    now
  });

  assert.equal(result.available, true);
  assert.equal(result.chairId, "chair-2");
});

test("recalculates downstream start times when an in-progress service started late", () => {
  const bookings = [
    makeBooking({
      _id: "late-start",
      status: "in-progress",
      startTime: new Date("2026-05-23T09:55:00.000Z"),
      endTime: new Date("2026-05-23T10:15:00.000Z"),
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      totalTime: 20
    }),
    makeBooking({
      _id: "waiting",
      startTime: new Date("2026-05-23T10:15:00.000Z"),
      endTime: new Date("2026-05-23T10:30:00.000Z"),
      createdAt: new Date("2026-05-23T09:56:00.000Z")
    })
  ];

  const arranged = arrangeBookings(bookings, oneChair, now);
  const waitingBooking = arranged.find((booking) => booking._id === "waiting");

  assert.equal(waitingBooking.startTime.toISOString(), "2026-05-23T10:20:00.000Z");
  assert.equal(waitingBooking.endTime.toISOString(), "2026-05-23T10:35:00.000Z");
});

test("ignores completed and cancelled bookings when arranging the active queue", () => {
  const bookings = [
    makeBooking({
      _id: "completed",
      status: "completed",
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      completedAt: new Date("2026-05-23T10:20:00.000Z")
    }),
    makeBooking({
      _id: "cancelled",
      status: "cancelled",
      startTime: new Date("2026-05-23T10:20:00.000Z"),
      endTime: new Date("2026-05-23T10:35:00.000Z"),
      cancelledAt: new Date("2026-05-23T10:10:00.000Z")
    }),
    makeBooking({
      _id: "active",
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:15:00.000Z"),
      createdAt: new Date("2026-05-23T09:56:00.000Z")
    })
  ];

  const arranged = arrangeBookings(bookings, oneChair, now);

  assert.equal(arranged.length, 1);
  assert.equal(arranged[0]._id, "active");
});

test("rejects a requested chair that is occupied even when another chair is free", () => {
  const bookings = [
    makeBooking({
      _id: "chair-1-live",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    })
  ];

  const result = findScheduledChairAvailability({
    bookings,
    chairsInput: chairs,
    scheduledStart: new Date("2026-05-23T10:05:00.000Z"),
    totalTime: 10,
    requestedChairId: "chair-1",
    now
  });

  assert.equal(result.available, false);
  assert.match(result.message, /reserved by the current queue/i);
});

test("estimateBookingForBarber returns the same scheduled conflict rejection used by booking routes", async () => {
  const RealDate = Date;
  const userFindById = User.findById;
  const bookingFind = Booking.find;
  const bookings = [
    makeBooking({
      _id: "in-progress",
      status: "in-progress",
      actualStartTime: new Date("2026-05-23T10:00:00.000Z"),
      startTime: new Date("2026-05-23T10:00:00.000Z"),
      endTime: new Date("2026-05-23T10:20:00.000Z"),
      totalTime: 20
    }),
    makeBooking({
      _id: "waiting",
      startTime: new Date("2026-05-23T10:20:00.000Z"),
      endTime: new Date("2026-05-23T10:35:00.000Z"),
      createdAt: new Date("2026-05-23T09:56:00.000Z"),
      toObject() {
        return { ...this };
      }
    })
  ];

  User.findById = async () => ({ _id: "barber-1", chairs: oneChair });
  Booking.find = () => ({
    sort: async () =>
      bookings.map((booking) => ({
        ...booking,
        toObject() {
          return { ...booking };
        }
      }))
  });
  global.Date = class extends RealDate {
    constructor(value) {
      if (arguments.length === 0) {
        super(now);
        return;
      }

      super(value);
    }

    static now() {
      return now.getTime();
    }
  };

  try {
    const estimate = await estimateBookingForBarber({
      barberId: "barber-1",
      totalTime: 10,
      bookingType: "scheduled",
      scheduledFor: new Date("2026-05-23T10:25:00.000Z"),
      requestedChairId: "chair-1"
    });

    assert.equal(estimate.available, false);
    assert.match(estimate.message, /reserved by the current queue/i);
  } finally {
    global.Date = RealDate;
    User.findById = userFindById;
    Booking.find = bookingFind;
  }
});
