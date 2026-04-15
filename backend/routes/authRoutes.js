const express = require("express");
const router = express.Router();
const User = require("../models/User");

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