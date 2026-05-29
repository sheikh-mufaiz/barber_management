const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const {
  closeSessionsForChairs,
  getActiveChairs,
  openSessionsForChairs,
  reconcileChairSessions,
  restoreChairStates,
  sanitizeChairs,
  setAllChairsActiveState
} = require("../utils/chairs");

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";
const PASSWORD_SALT_ROUNDS = 10;
const BCRYPT_HASH_PREFIX = /^\$2[aby]\$\d{2}\$/;

const buildAuthPayload = (user) => ({
  id: String(user._id),
  role: user.role
});

const issueToken = (user) => jwt.sign(buildAuthPayload(user), getJwtSecret(), { expiresIn: "7d" });

const serializeUser = (user) => {
  const plain = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete plain.password;
  return plain;
};

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH_PREFIX.test(value);

const canManageBarber = (req, barberId) =>
  req.user?.role === "barber" && String(req.user.id) === String(barberId);

const requireBarberOwner = (req, res, barberId) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", message: "No token provided" });
    return false;
  }

  if (!canManageBarber(req, barberId)) {
    res.status(403).json({ error: "Forbidden", message: "You can only manage your own shop" });
    return false;
  }

  return true;
};

const isValidChairPayload = (chairs) =>
  Array.isArray(chairs) &&
  chairs.length > 0 &&
  chairs.every(
    (chair) =>
      chair &&
      typeof chair.name === "string" &&
      chair.name.trim() &&
      (chair.id === undefined || typeof chair.id === "string") &&
      (chair.isActive === undefined || typeof chair.isActive === "boolean")
  );

const sanitizeShopSessions = (sessions) =>
  Array.isArray(sessions)
    ? sessions
        .map((session) => {
          const openedAt = new Date(session?.openedAt);
          const closedAt = session?.closedAt ? new Date(session.closedAt) : null;

          if (Number.isNaN(openedAt.getTime())) {
            return null;
          }

          return {
            openedAt,
            closedAt:
              closedAt && !Number.isNaN(closedAt.getTime()) && closedAt >= openedAt
                ? closedAt
                : null
          };
        })
        .filter(Boolean)
    : [];

// ✅ Register
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      shopName,
      phone,
      location,
      address,
      chairs
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "Registration failed",
        message: "Name, email, password, and role are required"
      });
    }

    // 🔥 Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: "Registration failed",
        message: "User already registered with this email",
      });
    }

    // ✅ Create new user
    const normalizedChairs =
      role === "barber"
        ? openSessionsForChairs(sanitizeChairs(chairs), new Date())
        : undefined;

    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      shopName,
      phone,
      location,
      address,
      shopSessions:
        role === "barber"
          ? sanitizeShopSessions([{ openedAt: new Date(), closedAt: null }])
          : undefined,
      chairs: normalizedChairs
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: serializeUser(user),
      token: issueToken(user),
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      error: "Server error",
      message: "Server error",
    });
  }
});


// ✅ Toggle shop open/close
router.put("/toggle-shop/:id", auth, async (req, res) => {
  try {
    if (!requireBarberOwner(req, res, req.params.id)) {
      return;
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }

    const now = new Date();
    const normalizedSessions = sanitizeShopSessions(user.shopSessions);

    if (user.role === "barber") {
      if (user.isOpen) {
        user.lastOpenChairIds = getActiveChairs(user.chairs).map((chair) => chair.id);
        const openIndex = normalizedSessions.findIndex((session) => session.closedAt === null);

        if (openIndex >= 0) {
          normalizedSessions[openIndex] = {
            ...normalizedSessions[openIndex],
            closedAt: now
          };
        } else {
          normalizedSessions.push({
            openedAt: now,
            closedAt: now
          });
        }
        user.chairs = setAllChairsActiveState(closeSessionsForChairs(user.chairs, now), false);
      } else {
        const restoredChairs = restoreChairStates(user.chairs, user.lastOpenChairIds);

        if (!getActiveChairs(restoredChairs).length) {
          return res.status(400).json({
            error: "Invalid shop state",
            message: "Add at least one active chair before opening the shop"
          });
        }

        normalizedSessions.push({
          openedAt: now,
          closedAt: null
        });

        user.chairs = openSessionsForChairs(restoredChairs, now);
        user.lastOpenChairIds = [];
      }

      user.shopSessions = normalizedSessions;
    }

    user.isOpen = !user.isOpen;

    await user.save();

    res.json({
      message: "Status updated",
      isOpen: user.isOpen,
    });

  } catch (error) {
    console.error("TOGGLE ERROR:", error);
    res.status(500).json({ error: "Server error", message: "Server error" });
  }
});


// ✅ Get open barbers
router.get("/barbers", auth, async (req, res) => {
  try {
    const barbers = await User.find({
      role: "barber",
      isOpen: true,
    });

    res.json(barbers);

  } catch (error) {
    console.error("FETCH BARBERS ERROR:", error);
    res.status(500).json({ error: "Server error", message: "Server error" });
  }
});

router.get("/chairs/:barberId", auth, async (req, res) => {
  try {
    const barber = await User.findById(req.params.barberId);

    if (!barber || barber.role !== "barber") {
      return res.status(404).json({ error: "Not found", message: "Barber not found" });
    }

    const chairs = sanitizeChairs(barber.chairs);

    if (JSON.stringify(chairs) !== JSON.stringify(barber.chairs || [])) {
      barber.chairs = chairs;
      await barber.save();
    }

    res.json(chairs);
  } catch (error) {
    console.error("FETCH CHAIRS ERROR:", error);
    res.status(500).json({ error: "Server error", message: "Server error" });
  }
});

router.put("/chairs/:barberId", auth, async (req, res) => {
  try {
    if (!requireBarberOwner(req, res, req.params.barberId)) {
      return;
    }

    if (!isValidChairPayload(req.body?.chairs)) {
      return res.status(400).json({
        error: "Invalid chair payload",
        message: "Send at least one chair with a valid name"
      });
    }

    const barber = await User.findById(req.params.barberId);

    if (!barber || barber.role !== "barber") {
      return res.status(404).json({ error: "Not found", message: "Barber not found" });
    }

    const chairs = reconcileChairSessions({
      previousChairs: barber.chairs,
      nextChairs: req.body?.chairs,
      isShopOpen: barber.isOpen,
      now: new Date()
    });

    if (barber.isOpen && !getActiveChairs(chairs).length) {
      return res.status(400).json({
        error: "Invalid chair payload",
        message: "Keep at least one active chair while the shop is open"
      });
    }

    barber.chairs = chairs;
    barber.lastOpenChairIds = Array.isArray(barber.lastOpenChairIds)
      ? barber.lastOpenChairIds.filter((chairId) => chairs.some((chair) => chair.id === chairId))
      : [];
    await barber.save();

    res.json({
      message: "Chairs updated",
      chairs
    });
  } catch (error) {
    console.error("UPDATE CHAIRS ERROR:", error);
    res.status(500).json({ error: "Server error", message: "Server error" });
  }
});


// ✅ Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Login failed",
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    let passwordMatches = false;

    if (user) {
      const storedPassword = user.password || "";

      if (isBcryptHash(storedPassword)) {
        passwordMatches = await bcrypt.compare(password, storedPassword);
      } else if (storedPassword === password) {
        passwordMatches = true;
        user.password = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
        await user.save();
      }
    }

    if (!user || !passwordMatches) {
      return res.status(400).json({
        error: "Login failed",
        message: "Invalid credentials",
      });
    }

    res.json({
      message: "Login successful",
      user: serializeUser(user),
      token: issueToken(user),
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: "Server error", message: "Server error" });
  }
});

module.exports = router;
