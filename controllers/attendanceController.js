const User = require("../models/User");
const EmployeeAttendance = require("../models/EmployeeAttendance");
const moment = require("moment");

// Fetch all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({}, "_id name email"); // fetch ID, name, email
    res.json({ success: true, employees });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Failed to fetch employees", error: err.message });
  }
};

// Fetch attendance of a specific employee (optionally by date)
exports.getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    const query = { employeeId };
    if (date) {
      const start = moment(date).startOf("day").toDate();
      const end = moment(date).endOf("day").toDate();
      query.date = { $gte: start, $lte: end };
    }

    const records = await EmployeeAttendance.find(query).sort({ date: -1 });
    res.json({ success: true, attendance: records });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Failed to fetch attendance", error: err.message });
  }
};

// Mark attendance for any employee
exports.markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, location } = req.body;
    const markedBy = req.user.id; // admin or current user marking

    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: "employeeId, date, and status required" });
    }

    const start = moment(date).startOf("day").toDate();
    const end = moment(date).endOf("day").toDate();

    let attendance = await EmployeeAttendance.findOne({ employeeId, date: { $gte: start, $lte: end } });

    if (attendance) {
      attendance.status = status;
      attendance.location = location || attendance.location;
      attendance.markedBy = markedBy;
      await attendance.save();
      return res.json({ success: true, message: "Attendance updated", attendance });
    }

    attendance = new EmployeeAttendance({
      employeeId,
      date: start,
      status,
      location,
      markedBy,
    });
    await attendance.save();
    res.json({ success: true, message: "Attendance marked", attendance });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Failed to mark attendance", error: err.message });
  }
};