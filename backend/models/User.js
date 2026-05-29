const mongoose = require("mongoose");
const chairSchema = require("./Chair");
const shopSessionSchema = new mongoose.Schema(
  {
    openedAt: Date,
    closedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String, // barber / customer

  // 🔥 barber fields
  shopName: String,
  phone: String,
  location: {
    lat: Number,
    lng: Number
  },
  address: String,
  isOpen: { type: Boolean, default: true },
  shopSessions: {
    type: [shopSessionSchema],
    default: []
  },
  lastOpenChairIds: {
    type: [String],
    default: []
  },
  chairs: {
    type: [chairSchema],
    default: [{ id: "chair-1", name: "Chair 1", isActive: true }]
  }
  
});

module.exports = mongoose.model("User", userSchema);
