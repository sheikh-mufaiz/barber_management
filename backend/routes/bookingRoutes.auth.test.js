const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const router = require("./bookingRoutes");

const getRoute = (path, method) =>
  router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods?.[method.toLowerCase()]
  ).route.stack;

const getRouteHandler = (path, method) => getRoute(path, method).at(-1).handle;
const getRouteMiddleware = (path, method, index = 0) => getRoute(path, method)[index].handle;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.payload = data;
    return this;
  }
});

test("booking estimate rejects missing auth", async () => {
  const middleware = getRouteMiddleware("/estimate-booking", "POST", 0);
  const res = createResponse();

  await middleware(
    {
      body: { barberId: "barber-1", totalTime: 30 },
      header: () => ""
    },
    res,
    () => {
      throw new Error("next should not run");
    }
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, "Authentication required");
});

test("scheduled booking creation rejects missing scheduled time", async () => {
  const handler = getRouteHandler("/book", "POST");
  const res = createResponse();

  await handler(
    {
      user: { id: "customer-1", role: "customer" },
      body: {
        barberId: "barber-1",
        customerId: "customer-1",
        customerName: "Aman",
        services: ["Haircut"],
        totalTime: 30,
        bookingType: "scheduled"
      }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, "Invalid booking");
});

test("analytics overview rejects malformed custom ranges", async () => {
  const handler = getRouteHandler("/analytics/overview", "GET");
  const res = createResponse();

  await handler(
    {
      user: { id: "barber-1", role: "barber" },
      query: {
        barberId: "barber-1",
        rangePreset: "custom",
        startDate: "2026-05-29"
      }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /Custom range/);
});

test("complete booking rejects the wrong barber", async () => {
  const findById = Booking.findById;

  Booking.findById = async () => ({
    _id: "booking-1",
    barberId: "barber-1",
    status: "booked"
  });

  try {
    const handler = getRouteHandler("/complete/:id", "PUT");
    const res = createResponse();

    await handler(
      {
        params: { id: "booking-1" },
        user: { id: "barber-2", role: "barber" }
      },
      res
    );

    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.error, "Forbidden");
  } finally {
    Booking.findById = findById;
  }
});
