const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Register
router.post("/register", async (req, res) => {
  const {
  name,
  email,
  password,
  role,
  shopName,
  phone,
  location,
  address
} = req.body;

  const user = new User({
  name,
  email,
  password,
  role,
  shopName,
  phone,
  location,
  address
});

  await user.save();

  res.json({ message: "User registered", user });
});

router.put("/toggle-shop/:id", async (req, res) => {
  const user = await User.findById(req.params.id);

  user.isOpen = !user.isOpen;

  await user.save();

  res.json({ message: "Status updated", isOpen: user.isOpen });
}); 

router.get("/barbers", async (req, res) => {
  const barbers = await User.find({
    role: "barber",
    isOpen: true
  });

  res.json(barbers);
});
// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  res.json({ message: "Login successful", user });
});

module.exports = router;