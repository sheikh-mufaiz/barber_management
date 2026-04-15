const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// 🔥 IMPORT MODEL (for auto delay system)
const Booking = require("./models/Booking");

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Routes
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");

app.use("/api", bookingRoutes);
app.use("/api", authRoutes);
app.use("/api", serviceRoutes);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("API is working 🚀");
});

// ✅ MongoDB connection
mongoose.connect("mongodb+srv://admin:admin123@cluster0.6ahzbd4.mongodb.net/barberApp")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));


// 🔥🔥 AUTO DELAY SYSTEM (SMART QUEUE)
setInterval(async () => {
  try {
    const now = new Date();

    // 🔥 get all bookings sorted
    const bookings = await Booking.find().sort({ startTime: 1 });

    if (bookings.length === 0) return;

    let currentTime = now;

    for (let booking of bookings) {
      // 🔥 if booking time already passed → shift
      if (booking.startTime < currentTime) {
        booking.startTime = new Date(currentTime);
        booking.endTime = new Date(
          currentTime.getTime() + booking.totalTime * 60000
        );

        currentTime = booking.endTime;

        await booking.save();
      } else {
        currentTime = booking.endTime;
      }
    }

    console.log("⏱ Queue auto-adjusted");

  } catch (err) {
    console.log("Auto delay error:", err.message);
  }
}, 60000); // every 1 min


// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});