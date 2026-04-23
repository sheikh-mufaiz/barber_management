const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  barberId: String,
  customerId: String,
  customerName: String,
  orderId: String,
  services: [String],
  totalTime: Number,
  startTime: Date,
  isOffline: { type: Boolean, default: false },
  endTime: Date,
  actualStartTime: Date,
  status: {
    type: String,
    default: "booked"
  }
});

module.exports = mongoose.model("Booking", bookingSchema);