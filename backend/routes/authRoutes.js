const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { getActiveChairs, sanitizeChairs } = require("../utils/chairs");

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

    // 🔥 Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already registered with this email",
      });
    }

    // ✅ Create new user
    const user = new User({
      name,
      email,
      password,
      role,
      shopName,
      phone,
      location,
      address,
      chairs: role === "barber" ? sanitizeChairs(chairs) : undefined
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user,
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
});


// ✅ Toggle shop open/close
router.put("/toggle-shop/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isOpen && user.role === "barber" && !getActiveChairs(user.chairs).length) {
      return res.status(400).json({
        message: "Add at least one active chair before opening the shop"
      });
    }

    user.isOpen = !user.isOpen;

    await user.save();

    res.json({
      message: "Status updated",
      isOpen: user.isOpen,
    });

  } catch (error) {
    console.error("TOGGLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Get open barbers
router.get("/barbers", async (req, res) => {
  try {
    const barbers = await User.find({
      role: "barber",
      isOpen: true,
    });

    res.json(barbers);

  } catch (error) {
    console.error("FETCH BARBERS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/chairs/:barberId", async (req, res) => {
  try {
    const barber = await User.findById(req.params.barberId);

    if (!barber || barber.role !== "barber") {
      return res.status(404).json({ message: "Barber not found" });
    }

    const chairs = sanitizeChairs(barber.chairs);

    if (JSON.stringify(chairs) !== JSON.stringify(barber.chairs || [])) {
      barber.chairs = chairs;
      await barber.save();
    }

    res.json(chairs);
  } catch (error) {
    console.error("FETCH CHAIRS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/chairs/:barberId", async (req, res) => {
  try {
    const barber = await User.findById(req.params.barberId);

    if (!barber || barber.role !== "barber") {
      return res.status(404).json({ message: "Barber not found" });
    }

    const chairs = sanitizeChairs(req.body?.chairs);

    if (barber.isOpen && !getActiveChairs(chairs).length) {
      return res.status(400).json({
        message: "Keep at least one active chair while the shop is open"
      });
    }

    barber.chairs = chairs;
    await barber.save();

    res.json({
      message: "Chairs updated",
      chairs
    });
  } catch (error) {
    console.error("UPDATE CHAIRS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, password });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    res.json({
      message: "Login successful",
      user,
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
