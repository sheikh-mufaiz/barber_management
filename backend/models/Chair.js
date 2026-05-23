const mongoose = require("mongoose");

const chairSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

module.exports = chairSchema;
