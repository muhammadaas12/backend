const mongoose = require("mongoose");

const weeklyPaySchema = new mongoose.Schema({
  location: String,
  weekStart: String, // e.g. "2026-03-23"
  totalAmount: Number,
});

module.exports = mongoose.model("WeeklyPay", weeklyPaySchema);