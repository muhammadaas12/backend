const mongoose = require("mongoose");

const employeeAttendanceSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ["Present", "Half-Day", "Home"], default: "Present" },
  location: { type: String },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who marked
}, { timestamps: true });

module.exports = mongoose.model("EmployeeAttendance", employeeAttendanceSchema);