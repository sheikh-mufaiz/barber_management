
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { recalculateAllQueues } = require("./utils/scheduler");
const { backfillLegacyBookingSnapshots } = require("./utils/bookingSnapshots");

const app = express();
app.use(express.json());
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
  .then(async () => {
    console.log("MongoDB Connected");

    const backfillResult = await backfillLegacyBookingSnapshots();
    console.log(`Booking snapshot backfill complete: ${backfillResult.updated} updated`);
  })
  .catch(err => console.log(err));


// 🔥🔥 AUTO DELAY SYSTEM (SMART QUEUE PER BARBER)
setInterval(async () => {
  try {
    await recalculateAllQueues();
    console.log("⏱ Queues auto-adjusted per barber");
  } catch (err) {
    console.log("Auto delay error:", err.message);
  }
}, 60000); // every 1 min


// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
