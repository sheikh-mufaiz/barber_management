const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const {
  estimateBookingForBarber,
  recalculateQueueForBarber
} = require("../utils/scheduler");
const {
  getCustomerProfile,
  getCustomerProfilesForBarber
} = require("../utils/customerProfiles");

// 🔥 ESTIMATE BOOKING (NO SAVE)
router.post("/estimate-booking", async (req, res) => {
  try {
    const {
      barberId,
      totalTime,
      bookingType = "instant",
      scheduledFor,
      chairId
    } = req.body;

    if (!barberId || !totalTime) {
      return res.status(400).json({
        available: false,
        message: "Missing required fields"
      });
    }

    const estimate = await estimateBookingForBarber({
      barberId,
      totalTime,
      bookingType,
      scheduledFor,
      requestedChairId: bookingType === "scheduled" ? chairId : null
    });

    res.status(estimate.available ? 200 : 409).json(estimate);

  } catch (error) {
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

// 🔥 CREATE BOOKING (AUTO TIME SLOT)
router.post("/book", async (req, res) => {
  try {
    const {
      barberId,
      services,
      totalTime,
      customerName,
      customerId,
      isOffline,
      bookingType = "instant",
      scheduledFor,
      chairId
    } = req.body;

    const normalizedBookingType =
      bookingType === "scheduled" ? "scheduled" : "instant";
    const requestedScheduleTime = scheduledFor ? new Date(scheduledFor) : null;

    // ✅ VALIDATION (FIXED)
    if (!barberId || !totalTime || (!customerId && !isOffline)) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    if (
      normalizedBookingType === "scheduled" &&
      (!requestedScheduleTime || isNaN(requestedScheduleTime.getTime()))
    ) {
      return res.status(400).json({
        message: "Please select a valid scheduled time"
      });
    }

    if (
      normalizedBookingType === "scheduled" &&
      requestedScheduleTime <= new Date()
    ) {
      return res.status(400).json({
        message: "Scheduled time must be in the future"
      });
    }

    // 🔥 Check if customer already has active booking with this barber
    if (customerId && !isOffline) {
      const existingBooking = await Booking.findOne({
        barberId,
        customerId,
        status: { $in: ["booked", "in-progress"] }
      });
      if (existingBooking) {
        return res.status(400).json({
          message: "You already have an active booking with this barber"
        });
      }
    }

    const estimate = await estimateBookingForBarber({
      barberId,
      totalTime,
      bookingType: normalizedBookingType,
      scheduledFor: requestedScheduleTime,
      requestedChairId:
        normalizedBookingType === "scheduled" ? chairId : null
    });

    if (!estimate.available) {
      return res.status(409).json({
        message: estimate.message || "No slot available right now"
      });
    }

    const selectedServices = await Service.find({
      barberId,
      name: { $in: services || [] }
    });
    const serviceMap = selectedServices.reduce((map, service) => {
      map[service.name] = service;
      return map;
    }, {});
    const serviceItems = (services || []).map((serviceName) => {
      const matchedService = serviceMap[serviceName];

      return {
        name: serviceName,
        duration: Number(matchedService?.duration || 0),
        price: Number(matchedService?.price || 0)
      };
    });
    const totalPrice = serviceItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

    const booking = new Booking({
      barberId,
      services,
      serviceItems,
      totalPrice,
      totalTime: Number(totalTime),
      bookingType: normalizedBookingType,
      scheduledFor:
        normalizedBookingType === "scheduled" ? requestedScheduleTime : null,
      startTime: estimate.estimatedStartTime,
      endTime: estimate.estimatedEndTime,
      chairId: estimate.chairId,
      chairName: estimate.chairName,
      customerName,
      customerId: customerId || null, // ✅ SAFE
      orderId: Date.now().toString(),
      isOffline: isOffline || false
    });

    await booking.save();
    await recalculateQueueForBarber(barberId);

    const updatedBooking = await Booking.findById(booking._id);

    res.json({
      message:
        normalizedBookingType === "scheduled"
          ? "Scheduled booking created ✅"
          : "Instant booking added ✅",
      booking: updatedBooking
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/customer-profile/:barberId/:customerId", async (req, res) => {
  try {
    const profile = await getCustomerProfile({
      barberId: req.params.barberId,
      customerId: req.params.customerId
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/customer-profiles/:barberId", async (req, res) => {
  try {
    const profiles = await getCustomerProfilesForBarber({
      barberId: req.params.barberId
    });

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 🔥 GET ALL BOOKINGS
router.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ startTime: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 🔥 CANCEL BOOKING (SECURE + SHIFT)
router.delete("/cancel/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { userId, role } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    // 🔥 CUSTOMER → only own booking (SAFE CHECK)
    if (
      role === "customer" &&
      booking.customerId &&
      booking.customerId !== userId
    ) {
      return res.status(403).json({
        message: "You can only cancel your own booking ❌"
      });
    }

    // 🔥 BARBER → only own shop
    if (
      role === "barber" &&
      booking.barberId.toString() !== userId
    ) {
      return res.status(403).json({
        message: "Not your shop booking ❌"
      });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelledBy = role || "unknown";
    await booking.save();

    await recalculateQueueForBarber(booking.barberId);

    res.json({
      message: "Booking cancelled & slots shifted 🔥"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 🔥 COMPLETE BOOKING (ONLY BARBER)
router.put("/complete/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { userId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    // 🔥 SECURITY FIX
    if (booking.barberId.toString() !== userId) {
      return res.status(403).json({
        message: "Only barber can complete booking ❌"
      });
    }

    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();

    await recalculateQueueForBarber(booking.barberId);

    res.json({
      message: "Booking completed & queue updated ✅"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ✅ START BOOKING
router.put("/start/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false });
    }

    // 🔥 FORCE update
    booking.status = "in-progress";
    booking.actualStartTime = new Date();

    await booking.save();
    await recalculateQueueForBarber(booking.barberId);

    const updatedBooking = await Booking.findById(req.params.id);

    console.log("START SAVED:", booking.actualStartTime); // ✅ DEBUG

    res.json({
      success: true,
      booking: updatedBooking || booking,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.delete("/delete-service/:id", async (req, res) => {
  try {
    console.log("DELETE ID:", req.params.id);

    const deleted = await Service.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE ERROR:", err); // 🔥 THIS WILL SHOW REAL ERROR
    res.status(500).json({ error: err.message });
  }
});
// ✅ EXPORT
module.exports = router;
