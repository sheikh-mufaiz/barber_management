const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const {
  buildChairMetrics,
  buildCustomerGrowth,
  filterBookingsByRange,
  getAnalyticsOverview,
  getRangeDurationMinutes,
  getRangeForPreset
} = require("./analytics");

const makeBooking = (overrides = {}) => ({
  _id: overrides._id || `booking-${Math.random()}`,
  barberId: "barber-1",
  customerId: "customer-1",
  customerName: "Aman",
  services: ["Haircut"],
  totalPrice: 100,
  status: "completed",
  startTime: new Date("2026-05-24T09:00:00.000Z"),
  completedAt: new Date("2026-05-24T09:30:00.000Z"),
  createdAt: new Date("2026-05-24T08:50:00.000Z"),
  updatedAt: new Date("2026-05-24T09:30:00.000Z"),
  ...overrides
});

test("builds preset ranges for today, week, month, and custom", () => {
  const now = new Date("2026-05-24T12:00:00.000Z");

  const today = getRangeForPreset({ rangePreset: "today", now });
  const week = getRangeForPreset({ rangePreset: "week", now });
  const month = getRangeForPreset({ rangePreset: "month", now });
  const custom = getRangeForPreset({
    rangePreset: "custom",
    startDate: "2026-05-20",
    endDate: "2026-05-21",
    now
  });

  assert.equal(today.start.getFullYear(), 2026);
  assert.equal(today.start.getMonth(), 4);
  assert.equal(today.start.getDate(), 24);
  assert.equal(today.start.getHours(), 0);
  assert.equal(today.end.getHours(), 23);
  assert.equal(today.end.getMinutes(), 59);
  assert.equal(week.start.getDate(), 18);
  assert.equal(month.start.getDate(), 1);
  assert.equal(custom.start.getDate(), 20);
  assert.equal(custom.start.getHours(), 0);
  assert.equal(custom.end.getDate(), 21);
  assert.equal(custom.end.getHours(), 23);
});

test("filters bookings by inclusive event-date boundaries", () => {
  const range = getRangeForPreset({
    rangePreset: "custom",
    startDate: "2026-05-24",
    endDate: "2026-05-24",
    now: new Date("2026-05-24T12:00:00.000Z")
  });

  const bookings = [
    makeBooking({
      _id: "in-range-start",
      completedAt: new Date(2026, 4, 24, 0, 0, 0, 0)
    }),
    makeBooking({
      _id: "in-range-end",
      completedAt: new Date(2026, 4, 24, 23, 59, 59, 999)
    }),
    makeBooking({
      _id: "out-of-range",
      completedAt: new Date(2026, 4, 25, 0, 0, 0, 0)
    })
  ];

  const filtered = filterBookingsByRange({ bookings, range });
  assert.deepEqual(
    filtered.map((booking) => booking._id),
    ["in-range-start", "in-range-end"]
  );
});

test("counts only first-time customers for growth", () => {
  const range = getRangeForPreset({
    rangePreset: "custom",
    startDate: "2026-05-24",
    endDate: "2026-05-24",
    now: new Date("2026-05-24T12:00:00.000Z")
  });

  const growth = buildCustomerGrowth({
    range,
    bookings: [
      makeBooking({
        _id: "first-aman",
        customerId: "customer-1",
        createdAt: new Date("2026-05-24T08:00:00.000Z"),
        completedAt: new Date("2026-05-24T08:30:00.000Z")
      }),
      makeBooking({
        _id: "repeat-aman",
        customerId: "customer-1",
        createdAt: new Date("2026-05-25T08:00:00.000Z"),
        completedAt: new Date("2026-05-25T08:30:00.000Z")
      }),
      makeBooking({
        _id: "old-riya",
        customerId: "customer-2",
        createdAt: new Date("2026-05-20T08:00:00.000Z"),
        completedAt: new Date("2026-05-20T08:30:00.000Z")
      })
    ]
  });

  assert.equal(growth, 1);
});

test("builds chair metrics with deterministic busiest-chair ranking", () => {
  const range = {
    start: new Date("2026-05-24T00:00:00.000Z"),
    end: new Date("2026-05-24T23:59:59.999Z")
  };

  const metrics = buildChairMetrics({
    chairs: [
      { id: "chair-1", name: "Chair 1", isActive: true },
      { id: "chair-2", name: "Chair 2", isActive: false },
      { id: "chair-3", name: "Chair 3", isActive: true }
    ],
    bookings: [
      makeBooking({
        _id: "chair-1-booking-a",
        chairId: "chair-1",
        chairName: "Chair 1",
        totalTime: 30,
        status: "completed"
      }),
      makeBooking({
        _id: "chair-1-booking-b",
        chairId: "chair-1",
        chairName: "Chair 1",
        totalTime: 15,
        status: "booked"
      }),
      makeBooking({
        _id: "chair-2-booking-a",
        chairId: "chair-2",
        chairName: "Chair 2",
        totalTime: 20,
        status: "completed"
      }),
      makeBooking({
        _id: "chair-2-cancelled",
        chairId: "chair-2",
        chairName: "Chair 2",
        totalTime: 50,
        status: "cancelled",
        cancelledAt: new Date("2026-05-24T10:00:00.000Z")
      })
    ],
    range
  });

  assert.equal(getRangeDurationMinutes(range), 1440);
  assert.equal(metrics.summary.busiestChairId, "chair-1");
  assert.equal(metrics.summary.busiestChairName, "Chair 1");
  assert.equal(metrics.summary.busiestChairBookings, 2);
  assert.deepEqual(metrics.perChair[0], {
    chairId: "chair-1",
    chairName: "Chair 1",
    isActive: true,
    bookingCount: 2,
    totalServiceMinutes: 45,
    averageServiceMinutes: 22.5,
    utilizationRate: 3.1,
    idleMinutes: 1395
  });
  assert.deepEqual(metrics.perChair[1], {
    chairId: "chair-2",
    chairName: "Chair 2",
    isActive: false,
    bookingCount: 1,
    totalServiceMinutes: 20,
    averageServiceMinutes: 20,
    utilizationRate: 1.4,
    idleMinutes: 1420
  });
  assert.equal(metrics.perChair[2].bookingCount, 0);
  assert.equal(metrics.perChair[2].idleMinutes, 1440);
});

test("builds analytics overview with barber and platform metrics", async () => {
  const bookingFind = Booking.find;
  const serviceFind = Service.find;
  const userFind = User.find;

  Booking.find = () => ({
    sort: async () => [
      makeBooking({
        _id: "today-completed",
        barberId: "barber-1",
        customerId: "customer-1",
        customerName: "Aman",
        services: ["Haircut"],
        totalPrice: 100,
        chairId: "chair-1",
        chairName: "Chair 1",
        totalTime: 30,
        status: "completed",
        completedAt: new Date("2026-05-24T09:30:00.000Z")
      }),
      makeBooking({
        _id: "today-cancelled",
        barberId: "barber-1",
        customerId: "customer-2",
        customerName: "Riya",
        services: ["Wax"],
        totalPrice: 50,
        chairId: "chair-2",
        chairName: "Chair 2",
        totalTime: 20,
        status: "cancelled",
        cancelledAt: new Date("2026-05-24T10:00:00.000Z"),
        completedAt: undefined
      }),
      makeBooking({
        _id: "other-shop",
        barberId: "barber-2",
        customerId: "customer-3",
        customerName: "Kabir",
        services: ["Beard"],
        totalPrice: 80,
        chairId: "chair-9",
        chairName: "Chair 9",
        totalTime: 25,
        status: "booked",
        startTime: new Date("2026-05-24T11:00:00.000Z"),
        completedAt: undefined
      }),
      makeBooking({
        _id: "older-growth-source",
        barberId: "barber-2",
        customerId: "customer-2",
        customerName: "Riya",
        services: ["Wax"],
        totalPrice: 50,
        chairId: "chair-8",
        chairName: "Chair 8",
        totalTime: 10,
        status: "completed",
        completedAt: new Date("2026-05-10T10:00:00.000Z")
      })
    ]
  });
  Service.find = async ({ barberId }) =>
    barberId === "barber-1"
      ? [
          { name: "Haircut", price: 100 },
          { name: "Wax", price: 50 }
        ]
      : [{ name: "Beard", price: 80 }];
  User.find = async () => [
    {
      _id: "barber-1",
      name: "Barber One",
      shopName: "Style Studio",
      isOpen: true,
      chairs: [
        { id: "chair-1", name: "Chair 1", isActive: true },
        { id: "chair-2", name: "Chair 2", isActive: false }
      ]
    },
    { _id: "barber-2", name: "Barber Two", shopName: "Fade House", isOpen: false, chairs: [] }
  ];

  try {
    const overview = await getAnalyticsOverview({
      barberId: "barber-1",
      rangePreset: "today",
      now: new Date("2026-05-24T12:00:00.000Z")
    });

    assert.equal(overview.barberMetrics.totalBookings, 1);
    assert.equal(overview.barberMetrics.estimatedRevenue, 100);
    assert.equal(overview.platformMetrics.totalPlatformBookings, 3);
    assert.equal(overview.platformMetrics.customerGrowth, 2);
    assert.equal(overview.platformMetrics.cancellationRate, 33.3);
    assert.equal(overview.platformMetrics.allBarberOverview.totalBarbers, 2);
    assert.equal(overview.platformMetrics.allBarberOverview.openShops, 1);
    assert.equal(overview.chairMetrics.summary.busiestChairId, "chair-1");
    assert.equal(overview.chairMetrics.perChair[0].utilizationRate, 2.1);
    assert.equal(overview.chairMetrics.perChair[1].bookingCount, 0);
    assert.equal(overview.topPerformingShops[0].shopName, "Style Studio");
    assert.equal(overview.topPerformingShops[0].bookings, 2);
  } finally {
    Booking.find = bookingFind;
    Service.find = serviceFind;
    User.find = userFind;
  }
});

test("handles zero-booking ranges without division issues", async () => {
  const bookingFind = Booking.find;
  const serviceFind = Service.find;
  const userFind = User.find;

  Booking.find = () => ({
    sort: async () => []
  });
  Service.find = async () => [];
  User.find = async () => [
    {
      _id: "barber-1",
      name: "Barber One",
      shopName: "Style Studio",
      isOpen: true,
      chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }]
    }
  ];

  try {
    const overview = await getAnalyticsOverview({
      barberId: "barber-1",
      rangePreset: "today",
      now: new Date("2026-05-24T12:00:00.000Z")
    });

    assert.equal(overview.platformMetrics.totalPlatformBookings, 0);
    assert.equal(overview.platformMetrics.cancellationRate, 0);
    assert.equal(overview.chairMetrics.summary.busiestChairBookings, 0);
    assert.equal(overview.chairMetrics.perChair[0].idleMinutes, 1440);
    assert.deepEqual(overview.topPerformingShops, []);
  } finally {
    Booking.find = bookingFind;
    Service.find = serviceFind;
    User.find = userFind;
  }
});
