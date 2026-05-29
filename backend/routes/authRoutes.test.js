const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const router = require("./authRoutes");

const getRouteHandler = (path, method) =>
  router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods?.[method.toLowerCase()]
  ).route.stack.at(-1).handle;

const getRouteMiddleware = (path, method, index = 0) =>
  router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods?.[method.toLowerCase()]
  ).route.stack[index].handle;

const createResponse = () => {
  const response = {
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
  };

  return response;
};

test("register hashes passwords before saving and omits them from the response", async () => {
  const findOne = User.findOne;
  const save = User.prototype.save;
  const handler = getRouteHandler("/register", "POST");
  let savedUser;

  User.findOne = async () => null;
  User.prototype.save = async function saveUser() {
    savedUser = this;
  };

  try {
    const res = createResponse();
    await handler(
      {
        body: {
          name: "Aman",
          email: "aman@example.com",
          password: "secret123",
          role: "customer"
        }
      },
      res
    );

    assert.equal(res.statusCode, 201);
    assert.ok(savedUser.password);
    assert.notEqual(savedUser.password, "secret123");
    assert.equal(await bcrypt.compare("secret123", savedUser.password), true);
    assert.equal(res.payload.user.password, undefined);
    assert.ok(res.payload.token);
  } finally {
    User.findOne = findOne;
    User.prototype.save = save;
  }
});

test("login compares the submitted password against the stored bcrypt hash", async () => {
  const findOne = User.findOne;
  const handler = getRouteHandler("/login", "POST");
  const hashedPassword = await bcrypt.hash("secret123", 10);
  let receivedQuery;

  User.findOne = async (query) => {
    receivedQuery = query;
    return {
      _id: "customer-1",
      name: "Aman",
      email: "aman@example.com",
      password: hashedPassword,
      role: "customer",
      toObject() {
        return { ...this };
      }
    };
  };

  try {
    const res = createResponse();
    await handler(
      {
        body: {
          email: "aman@example.com",
          password: "secret123"
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(receivedQuery, { email: "aman@example.com" });
    assert.equal(res.payload.user.password, undefined);
    assert.ok(res.payload.token);
  } finally {
    User.findOne = findOne;
  }
});

test("login rejects an invalid bcrypt password", async () => {
  const findOne = User.findOne;
  const handler = getRouteHandler("/login", "POST");
  const hashedPassword = await bcrypt.hash("secret123", 10);

  User.findOne = async () => ({
    _id: "customer-1",
    name: "Aman",
    email: "aman@example.com",
    password: hashedPassword,
    role: "customer",
    toObject() {
      return { ...this };
    }
  });

  try {
    const res = createResponse();
    await handler(
      {
        body: {
          email: "aman@example.com",
          password: "wrong-password"
        }
      },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, "Login failed");
  } finally {
    User.findOne = findOne;
  }
});

test("login accepts a legacy plaintext password and upgrades it to bcrypt", async () => {
  const findOne = User.findOne;
  const handler = getRouteHandler("/login", "POST");
  const user = {
    _id: "customer-1",
    name: "Aman",
    email: "aman@example.com",
    password: "legacy-secret",
    role: "customer",
    async save() {
      this.saved = true;
    },
    toObject() {
      return { ...this };
    }
  };

  User.findOne = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        body: {
          email: "aman@example.com",
          password: "legacy-secret"
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.saved, true);
    assert.notEqual(user.password, "legacy-secret");
    assert.equal(await bcrypt.compare("legacy-secret", user.password), true);
    assert.equal(res.payload.user.password, undefined);
  } finally {
    User.findOne = findOne;
  }
});

test("toggle-shop opens a new active shop session", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/toggle-shop/:id", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: false,
    chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }],
    lastOpenChairIds: ["chair-1"],
    shopSessions: [],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(user.isOpen, true);
    assert.equal(user.shopSessions.length, 1);
    assert.ok(user.shopSessions[0].openedAt instanceof Date);
    assert.equal(user.shopSessions[0].closedAt, null);
    assert.equal(user.chairs[0].sessions.length, 1);
    assert.ok(user.chairs[0].sessions[0].startedAt instanceof Date);
    assert.equal(user.chairs[0].sessions[0].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("toggle-shop closes the latest active shop session", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/toggle-shop/:id", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: true,
    chairs: [
      {
        id: "chair-1",
        name: "Chair 1",
        isActive: true,
        sessions: [{ startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: null }]
      },
      {
        id: "chair-2",
        name: "Chair 2",
        isActive: false,
        sessions: []
      }
    ],
    lastOpenChairIds: [],
    shopSessions: [{ openedAt: new Date("2026-05-29T09:00:00.000Z"), closedAt: null }],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(user.isOpen, false);
    assert.equal(user.shopSessions.length, 1);
    assert.ok(user.shopSessions[0].closedAt instanceof Date);
    assert.ok(user.chairs[0].sessions[0].endedAt instanceof Date);
    assert.equal(user.chairs[0].isActive, false);
    assert.equal(user.chairs[1].isActive, false);
    assert.deepEqual(user.lastOpenChairIds, ["chair-1"]);
  } finally {
    User.findById = findById;
  }
});

test("toggle-shop builds valid session history across repeated toggles", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/toggle-shop/:id", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: false,
    chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }],
    lastOpenChairIds: ["chair-1"],
    shopSessions: [],
    async save() {}
  };

  User.findById = async () => user;

  try {
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, createResponse());
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, createResponse());
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, createResponse());

    assert.equal(user.isOpen, true);
    assert.equal(user.shopSessions.length, 2);
    assert.ok(user.shopSessions[0].openedAt instanceof Date);
    assert.ok(user.shopSessions[0].closedAt instanceof Date);
    assert.ok(user.shopSessions[1].openedAt instanceof Date);
    assert.equal(user.shopSessions[1].closedAt, null);
    assert.equal(user.chairs[0].sessions.length, 2);
    assert.ok(user.chairs[0].sessions[0].endedAt instanceof Date);
    assert.equal(user.chairs[0].sessions[1].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("toggle-shop restores only the chairs that were active before closing", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/toggle-shop/:id", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: false,
    chairs: [
      {
        id: "chair-1",
        name: "Chair 1",
        isActive: false,
        sessions: [{ startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: new Date("2026-05-29T10:00:00.000Z") }]
      },
      {
        id: "chair-2",
        name: "Chair 2",
        isActive: false,
        sessions: []
      }
    ],
    lastOpenChairIds: ["chair-1"],
    shopSessions: [{ openedAt: new Date("2026-05-29T09:00:00.000Z"), closedAt: new Date("2026-05-29T10:00:00.000Z") }],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler({ params: { id: "barber-1" }, user: { id: "barber-1", role: "barber" } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(user.isOpen, true);
    assert.equal(user.chairs[0].isActive, true);
    assert.equal(user.chairs[1].isActive, false);
    assert.equal(user.chairs[0].sessions.length, 2);
    assert.equal(user.chairs[0].sessions[1].endedAt, null);
    assert.deepEqual(user.lastOpenChairIds, []);
  } finally {
    User.findById = findById;
  }
});

test("updating chairs closes only the turned-off chair session while the shop remains open", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: true,
    chairs: [
      {
        id: "chair-1",
        name: "Chair 1",
        isActive: true,
        sessions: [{ startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: null }]
      },
      {
        id: "chair-2",
        name: "Chair 2",
        isActive: true,
        sessions: [{ startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: null }]
      }
    ],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        params: { barberId: "barber-1" },
        user: { id: "barber-1", role: "barber" },
        body: {
          chairs: [
            { id: "chair-1", name: "Chair 1", isActive: false },
            { id: "chair-2", name: "Chair 2", isActive: true }
          ]
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.chairs[0].isActive, false);
    assert.ok(user.chairs[0].sessions[0].endedAt instanceof Date);
    assert.equal(user.chairs[1].sessions[0].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("updating chairs starts a session for a newly reactivated chair while the shop is open", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: true,
    chairs: [
      {
        id: "chair-1",
        name: "Chair 1",
        isActive: false,
        sessions: [{ startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: new Date("2026-05-29T10:00:00.000Z") }]
      }
    ],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        params: { barberId: "barber-1" },
        user: { id: "barber-1", role: "barber" },
        body: {
          chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }]
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.chairs[0].sessions.length, 2);
    assert.equal(user.chairs[0].sessions[0].endedAt?.toISOString(), "2026-05-29T10:00:00.000Z");
    assert.equal(user.chairs[0].sessions[1].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("updating chairs starts a first session for a new active chair while the shop is open", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: true,
    chairs: [{ id: "chair-1", name: "Chair 1", isActive: true, sessions: [] }],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        params: { barberId: "barber-1" },
        user: { id: "barber-1", role: "barber" },
        body: {
          chairs: [
            { id: "chair-1", name: "Chair 1", isActive: true },
            { id: "chair-2", name: "Chair 2", isActive: true }
          ]
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.chairs.length, 2);
    assert.equal(user.chairs[1].sessions.length, 1);
    assert.equal(user.chairs[1].sessions[0].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("updating an existing chair preserves saved session history instead of trusting client payload sessions", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: true,
    chairs: [
      {
        id: "chair-1",
        name: "Chair 1",
        isActive: false,
        sessions: [
          { startedAt: new Date("2026-05-29T09:00:00.000Z"), endedAt: new Date("2026-05-29T10:00:00.000Z") }
        ]
      }
    ],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        params: { barberId: "barber-1" },
        user: { id: "barber-1", role: "barber" },
        body: {
          chairs: [
            {
              id: "chair-1",
              name: "Chair 1",
              isActive: true,
              sessions: []
            }
          ]
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.chairs[0].sessions.length, 2);
    assert.equal(user.chairs[0].sessions[0].startedAt.toISOString(), "2026-05-29T09:00:00.000Z");
    assert.equal(user.chairs[0].sessions[0].endedAt?.toISOString(), "2026-05-29T10:00:00.000Z");
    assert.equal(user.chairs[0].sessions[1].endedAt, null);
  } finally {
    User.findById = findById;
  }
});

test("deleting a chair also removes it from the saved reopen snapshot", async () => {
  const findById = User.findById;
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const user = {
    _id: "barber-1",
    role: "barber",
    isOpen: false,
    lastOpenChairIds: ["chair-1", "chair-2"],
    chairs: [
      { id: "chair-1", name: "Chair 1", isActive: false, sessions: [] },
      { id: "chair-2", name: "Chair 2", isActive: false, sessions: [] }
    ],
    async save() {}
  };

  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler(
      {
        params: { barberId: "barber-1" },
        user: { id: "barber-1", role: "barber" },
        body: {
          chairs: [{ id: "chair-1", name: "Chair 1", isActive: false }]
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(user.lastOpenChairIds, ["chair-1"]);
    assert.equal(user.chairs.length, 1);
  } finally {
    User.findById = findById;
  }
});

test("protected chair updates reject missing auth before the handler runs", async () => {
  const middleware = getRouteMiddleware("/chairs/:barberId", "PUT", 0);
  const res = createResponse();

  await middleware(
    {
      params: { barberId: "barber-1" },
      body: { chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }] },
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

test("chair updates reject a different barber", async () => {
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const res = createResponse();

  await handler(
    {
      params: { barberId: "barber-1" },
      user: { id: "barber-2", role: "barber" },
      body: { chairs: [{ id: "chair-1", name: "Chair 1", isActive: true }] }
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, "Forbidden");
});

test("chair updates reject invalid chair payloads", async () => {
  const handler = getRouteHandler("/chairs/:barberId", "PUT");
  const res = createResponse();

  await handler(
    {
      params: { barberId: "barber-1" },
      user: { id: "barber-1", role: "barber" },
      body: { chairs: [{ id: "chair-1", name: "   ", isActive: true }] }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, "Invalid chair payload");
});
