const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");


// 🔥 CREATE BOOKING (AUTO TIME SLOT)
router.post("/book", async (req, res) => {
  try {
    const {
      barberId,
      services,
      totalTime,
      customerName,
      customerId,
      isOffline
    } = req.body;

    // ✅ VALIDATION (FIXED)
    if (!barberId || !totalTime || (!customerId && !isOffline)) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    // 🔥 Check if customer already has active booking with this barber
    if (customerId && !isOffline) {
      const existingBooking = await Booking.findOne({
        barberId,
        customerId,
        endTime: { $gt: new Date() } // Active booking (not ended)
      });
      if (existingBooking) {
        return res.status(400).json({
          message: "You already have an active booking with this barber"
        });
      }
    }

    // 🔥 Get last booking
    const lastBooking = await Booking.findOne({ barberId })
      .sort({ endTime: -1 });

    let start = lastBooking?.endTime
      ? new Date(lastBooking.endTime)
      : new Date();

    const end = new Date(start.getTime() + totalTime * 60000);

    const booking = new Booking({
      barberId,
      services,
      totalTime,
      startTime: start,
      endTime: end,
      customerName,
      customerId: customerId || null, // ✅ SAFE
      orderId: Date.now().toString(),
      isOffline: isOffline || false
    });

    await booking.save();

    res.json({
      message: "Booking auto-assigned ✅",
      booking
    });

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

    const deletedBooking = await Booking.findByIdAndDelete(bookingId);

    // 🔥 SHIFT BOOKINGS
    const futureBookings = await Booking.find({
      barberId: deletedBooking.barberId,
      startTime: { $gt: deletedBooking.startTime }
    }).sort({ startTime: 1 });

    let prevEndTime = deletedBooking.startTime;

    for (let b of futureBookings) {
      b.startTime = new Date(prevEndTime);
      b.endTime = new Date(
        prevEndTime.getTime() + b.totalTime * 60000
      );

      prevEndTime = b.endTime;

      await b.save();
    }

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

    const completed = await Booking.findByIdAndDelete(bookingId);

    // 🔥 SHIFT BOOKINGS
    const futureBookings = await Booking.find({
      barberId: completed.barberId,
      startTime: { $gt: completed.startTime }
    }).sort({ startTime: 1 });

    let prevEndTime = new Date();

    for (let b of futureBookings) {
      b.startTime = new Date(prevEndTime);
      b.endTime = new Date(
        prevEndTime.getTime() + b.totalTime * 60000
      );

      prevEndTime = b.endTime;

      await b.save();
    }

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

    console.log("START SAVED:", booking.actualStartTime); // ✅ DEBUG

    res.json({
      success: true,
      booking,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
// ✅ EXPORT
module.exports = router;