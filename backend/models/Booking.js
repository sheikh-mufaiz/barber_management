const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    barberId: String,
    customerId: String,
    customerName: String,
    orderId: String,
    services: [String],
    totalTime: Number,
    bookingType: {
      type: String,
      enum: ["instant", "scheduled"],
      default: "instant"
    },
    scheduledFor: Date,
    startTime: Date,
    chairId: String,
    chairName: String,
    isOffline: { type: Boolean, default: false },
    endTime: Date,
    actualStartTime: Date,
    status: {
      type: String,
      default: "booked"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
