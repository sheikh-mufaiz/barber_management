const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    barberId: String,
    customerId: String,
    customerName: String,
    orderId: String,
    services: [String],
    serviceItems: [
      {
        name: String,
        duration: Number,
        price: Number
      }
    ],
    totalPrice: Number,
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
      enum: ["booked", "in-progress", "completed", "cancelled"],
      default: "booked"
    },
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
