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
const { getAnalyticsOverview } = require("../utils/analytics");
const {
  buildBookingServiceSnapshot,
  getBookingTotalDuration,
  getBookingTotalPrice,
  validateBookingServiceSnapshot
} = require("../utils/bookingSnapshots");
const auth = require("../middleware/auth");

const isBarberOwner = (req, barberId) =>
  req.user?.role === "barber" && String(req.user.id) === String(barberId);

const isCustomerOwner = (req, customerId) =>
  req.user?.role === "customer" && String(req.user.id) === String(customerId);

const forbidden = (res, message = "You are not allowed to access this resource") =>
  res.status(403).json({ error: "Forbidden", message });

const getErrorMessage = (error) => error?.message || "Server error";

// 🔥 ESTIMATE BOOKING (NO SAVE)
router.post("/estimate-booking", auth, async (req, res) => {
  try {
    const {
      barberId,
      totalTime,
      bookingType = "instant",
      scheduledFor,
      chairId
    } = req.body;

    const numericTotalTime = Number(totalTime);

    if (!barberId || !Number.isFinite(numericTotalTime) || numericTotalTime <= 0) {
      return res.status(400).json({
        error: "Invalid booking",
        available: false,
        message: "Missing required fields"
      });
    }

    const estimate = await estimateBookingForBarber({
      barberId,
      totalTime: numericTotalTime,
      bookingType,
      scheduledFor,
      requestedChairId: bookingType === "scheduled" ? chairId : null
    });

    res.status(estimate.available ? 200 : 409).json(estimate);

  } catch (error) {
    res.status(500).json({
      error: "Server error",
      available: false,
      message: getErrorMessage(error)
    });
  }
});

// 🔥 CREATE BOOKING (AUTO TIME SLOT)
router.post("/book", auth, async (req, res) => {
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
    const requestedServices = Array.isArray(services) ? services : [];
    const numericTotalTime = Number(totalTime);

    // ✅ VALIDATION (FIXED)
    if (!barberId || (!customerId && !isOffline)) {
      return res.status(400).json({
        error: "Invalid booking",
        message: "Missing required fields"
      });
    }

    if (isOffline) {
      if (!isBarberOwner(req, barberId)) {
        return forbidden(res, "Only the shop owner can add walk-ins");
      }
    } else if (!isCustomerOwner(req, customerId)) {
      return forbidden(res, "Customers can only create bookings for themselves");
    }

    if (!requestedServices.length) {
      return res.status(400).json({
        error: "Invalid booking",
        message: "Select at least one service"
      });
    }

    if (!Number.isFinite(numericTotalTime) || numericTotalTime <= 0) {
      return res.status(400).json({
        error: "Invalid booking",
        message: "Total time must be greater than zero"
      });
    }

    if (
      normalizedBookingType === "scheduled" &&
      (!requestedScheduleTime || isNaN(requestedScheduleTime.getTime()))
    ) {
      return res.status(400).json({
        error: "Invalid booking",
        message: "Please select a valid scheduled time"
      });
    }

    if (
      normalizedBookingType === "scheduled" &&
      requestedScheduleTime <= new Date()
    ) {
      return res.status(400).json({
        error: "Invalid booking",
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
          error: "Active booking exists",
          message: "You already have an active booking with this barber"
        });
      }
    }

    const estimate = await estimateBookingForBarber({
      barberId,
      totalTime: numericTotalTime,
      bookingType: normalizedBookingType,
      scheduledFor: requestedScheduleTime,
      requestedChairId:
        normalizedBookingType === "scheduled" ? chairId : null
    });

    if (!estimate.available) {
      return res.status(409).json({
        error: "Slot unavailable",
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
    const snapshotValidation = validateBookingServiceSnapshot({
      requestedServices,
      serviceMap
    });

    if (snapshotValidation.hasMissingServices) {
      return res.status(400).json({
        error: "Invalid booking",
        message: `Unknown services: ${snapshotValidation.missingServices.join(", ")}`
      });
    }

    const serviceItems = buildBookingServiceSnapshot({
      services: requestedServices,
      serviceMap
    });
    const snapshotTotalTime = getBookingTotalDuration({ serviceItems });
    const normalizedTotalTime = snapshotTotalTime || Number(totalTime || 0);

    if (!normalizedTotalTime) {
      return res.status(400).json({
        error: "Invalid booking",
        message: "Total time must be greater than zero"
      });
    }

    const totalPrice = getBookingTotalPrice({ serviceItems });

    const booking = new Booking({
      barberId,
      services: requestedServices,
      serviceItems,
      totalPrice,
      totalTime: normalizedTotalTime,
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
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});

router.get("/customer-profile/:barberId/:customerId", auth, async (req, res) => {
  try {
    if (!isBarberOwner(req, req.params.barberId) && !isCustomerOwner(req, req.params.customerId)) {
      return forbidden(res);
    }

    const profile = await getCustomerProfile({
      barberId: req.params.barberId,
      customerId: req.params.customerId
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});

router.get("/customer-profiles/:barberId", auth, async (req, res) => {
  try {
    if (!isBarberOwner(req, req.params.barberId)) {
      return forbidden(res, "Only the shop owner can view all customer profiles");
    }

    const profiles = await getCustomerProfilesForBarber({
      barberId: req.params.barberId
    });

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});

router.get("/analytics/overview", auth, async (req, res) => {
  try {
    const { barberId, rangePreset = "today", startDate, endDate } = req.query;

    if (!isBarberOwner(req, barberId)) {
      return forbidden(res, "Only the shop owner can view analytics");
    }

    const overview = await getAnalyticsOverview({
      barberId,
      rangePreset,
      startDate,
      endDate
    });

    res.json(overview);
  } catch (error) {
    const statusCode =
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("before")
        ? 400
        : 500;

    res.status(statusCode).json({ error: getErrorMessage(error), message: getErrorMessage(error) });
  }
});


// 🔥 GET ALL BOOKINGS
router.get("/bookings", auth, async (req, res) => {
  try {
    const query = {};

    if (req.user.role === "barber") {
      query.barberId = String(req.query.barberId || req.user.id);

      if (String(query.barberId) !== String(req.user.id)) {
        return forbidden(res, "Barbers can only view their own bookings");
      }
    } else if (req.user.role === "customer") {
      if (req.query.barberId) {
        query.barberId = String(req.query.barberId);
      } else {
        query.customerId = String(req.user.id);
      }
    }

    const bookings = await Booking.find(query).sort({ startTime: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});


// 🔥 CANCEL BOOKING (SECURE + SHIFT)
router.delete("/cancel/:id", auth, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Not found",
        message: "Booking not found"
      });
    }

    if (!isBarberOwner(req, booking.barberId) && !isCustomerOwner(req, booking.customerId)) {
      return forbidden(res, "You can only cancel bookings that belong to you");
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user.role || "unknown";
    await booking.save();

    await recalculateQueueForBarber(booking.barberId);

    res.json({
      message: "Booking cancelled & slots shifted 🔥"
    });

  } catch (error) {
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});


// 🔥 COMPLETE BOOKING (ONLY BARBER)
router.put("/complete/:id", auth, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Not found",
        message: "Booking not found"
      });
    }

    if (!isBarberOwner(req, booking.barberId)) {
      return forbidden(res, "Only the shop owner can complete bookings");
    }

    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();

    await recalculateQueueForBarber(booking.barberId);

    res.json({
      message: "Booking completed & queue updated ✅"
    });

  } catch (error) {
    res.status(500).json({ error: "Server error", message: getErrorMessage(error) });
  }
});


// ✅ START BOOKING
router.put("/start/:id", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false });
    }

    if (!isBarberOwner(req, booking.barberId)) {
      return forbidden(res, "Only the shop owner can start bookings");
    }

    // 🔥 FORCE update
    booking.status = "in-progress";
    booking.actualStartTime = new Date();

    await booking.save();
    await recalculateQueueForBarber(booking.barberId);

    const updatedBooking = await Booking.findById(req.params.id);

    res.json({
      success: true,
      booking: updatedBooking || booking,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: getErrorMessage(err), success: false });
  }
});

router.delete("/delete-service/:id", auth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ error: "Not found", message: "Not found" });
    }

    if (!isBarberOwner(req, service.barberId)) {
      return forbidden(res, "You can only delete your own services");
    }

    await Service.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Server error", message: getErrorMessage(err) });
  }
});
// ✅ EXPORT
module.exports = router;
