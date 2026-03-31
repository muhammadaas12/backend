const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String }, // optional for invoices
  date: { type: Date, required: true },

  status: { type: String },       // optional for invoices
  location: { type: mongoose.Schema.Types.Mixed },
  projectLocation: { type: String },      // can be string or coordinates
  
  
  path: { type: String },         // uploaded file path
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;