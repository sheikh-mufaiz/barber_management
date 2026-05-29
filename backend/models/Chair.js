const mongoose = require("mongoose");
const chairSessionSchema = new mongoose.Schema(
  {
    startedAt: Date,
    endedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const chairSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    isActive: {
      type: Boolean,
      default: true
    },
    sessions: {
      type: [chairSessionSchema],
      default: []
    }
  },
  { _id: false }
);

module.exports = chairSchema;
