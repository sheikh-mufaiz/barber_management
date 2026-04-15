const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  name: String,
  duration: Number, // in minutes
  price: Number,
  barberId: String
});

module.exports = mongoose.model("Service", serviceSchema);