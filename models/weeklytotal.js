// models/WeeklyTotal.js
const mongoose = require("mongoose");

const WeeklyTotalSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  folder: { type: String, required: true },
  weekStart: { type: String, required: true }, // "YYYY-MM-DD"
  bills: { type: [Number], required: true },    // 7 numbers
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("WeeklyTotal", WeeklyTotalSchema);