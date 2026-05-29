const express = require("express");
const router = express.Router();
const Service = require("../models/Service");
const auth = require("../middleware/auth");

// 🔥 Add service (barber)
router.post("/add-service", auth, async (req, res) => {
  try {
    const { name, duration, price, barberId } = req.body;
    const numericDuration = Number(duration);
    const numericPrice = price === undefined || price === "" ? 0 : Number(price);

    if (req.user?.role !== "barber" || String(req.user.id) !== String(barberId)) {
      return res.status(403).json({ error: "Forbidden", message: "You can only manage your own services" });
    }

    if (!name || !String(name).trim() || !Number.isFinite(numericDuration) || numericDuration <= 0) {
      return res.status(400).json({ error: "Invalid service", message: "Service name and duration are required" });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Invalid service", message: "Service price must be zero or more" });
    }

    const service = new Service({
      name: String(name).trim(),
      duration: numericDuration,
      price: numericPrice,
      barberId
    });

    await service.save();

    res.json({ message: "Service added", service });
  } catch (error) {
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// 🔥 Get services for a barber
router.get("/services/:barberId", auth, async (req, res) => {
  try {
    const services = await Service.find({
      barberId: req.params.barberId
    });

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

module.exports = router;
