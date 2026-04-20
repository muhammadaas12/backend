// models/EmployeeWeeklyPay.js
const mongoose = require("mongoose");

const employeeWeeklyPaySchema = new mongoose.Schema({
  location: String,
  weekStart: String,
  employeeId:String,
  employeeName: String,
  amount: Number,
});

module.exports = mongoose.model("WeeklyPay", employeeWeeklyPaySchema);