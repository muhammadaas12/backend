// models/Invoice.js
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  folder: {
    type: String,
    default: "default",
    trim: true,
  },
  path: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  saveWeekly: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    default: "",
    trim: true,
  },
});

module.exports = mongoose.model("Invoice", invoiceSchema);