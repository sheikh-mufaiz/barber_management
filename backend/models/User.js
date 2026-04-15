const mongoose = require("mongoose");

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
  isOpen: { type: Boolean, default: true }
  
});

module.exports = mongoose.model("User", userSchema);