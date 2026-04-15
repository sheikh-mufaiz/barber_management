const express = require("express");
const router = express.Router();
const Service = require("../models/Service");

// 🔥 Add service (barber)
router.post("/add-service", async (req, res) => {
  const { name, duration, price, barberId } = req.body;

  const service = new Service({
    name,
    duration,
    price,
    barberId
  });

  await service.save();

  res.json({ message: "Service added", service });
});

// 🔥 Get services for a barber
router.get("/services/:barberId", async (req, res) => {
  const services = await Service.find({
    barberId: req.params.barberId
  });

  res.json(services);
});

module.exports = router;