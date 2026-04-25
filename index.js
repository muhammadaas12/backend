const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
dotenv.config();

const User = require("./models/User");
const Employee = require("./models/employee");
const Attendance = require("./models/attendance");
const Report = require("./models/Report");
const Project = require("./models/Project");
const WeeklyTotal = require("./models/weeklytotal");
const adminUser = require("./models/adminUser");
const Folder = require("./models/Folder");
const Invoice = require("./models/invoice");
const WeeklyPay = require("./models/weeklyPay");
const customerUser = require("./models/customerUser");

const {
  uploadInvoice,
  getInvoices,
  getInvoicesByFolders,
  deleteInvoice,
  deleteFolder,
  createFolder,
  getFolders,
  getInvoicesByFoldersForLocation,
} = require("./controllers/invoiceCOntroller");
const invoice = require("./models/invoice");

const app = express();
const port = process.env.PORT || 8000;

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Authentication ----------
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, "secretKey");
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ============================================
// REPORTS – Cloudinary URLs only (no local storage)
// ============================================
app.post("/reports", async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      workDescription,
      media,
      mediaType,
      projectLocation,
      projectId,
    } = req.body;

    if (!employeeId || !employeeName || !workDescription || !projectLocation) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const report = new Report({
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      workDescription: workDescription.trim(),
      media: media || null,
      mediaType: mediaType || null,
      projectId: projectId || null,
      projectLocation: projectLocation.trim(),
    });

    await report.save();
    res.status(201).json({ message: "Report created successfully", report });
  } catch (err) {
    console.error("Report creation error:", err);
    res.status(500).json({ message: "Failed to create report", error: err.message });
  }
});
app.get("/reports", async (req, res) => {
  try {
    const { employeeId, projectId } = req.query;
    let query = {};
    if (employeeId) query.employeeId = employeeId;
    if (projectId) query.projectId = projectId;
    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "Error fetching reports", error: err.message });
  }
});

app.get("/customerreports", async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ message: "location is required" });
    const reports = await Report.find({ projectLocation: location }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching customer reports", error: err.message });
  }
});

// ---------- Projects ----------
app.post("/projects", async (req, res) => {
  try {
    const { projectName, labourId } = req.body;
    const project = new Project({ projectName, labourId });
    await project.save();
    res.status(201).json({ message: "Project created", project });
  } catch (err) {
    res.status(500).json({ message: "Failed to create project", error: err.message });
  }
});

app.get("/projects", async (req, res) => {
  try {
    const { labourId } = req.query;
    const projects = await Project.find({ labourId });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch projects", error: err.message });
  }
});

// ---------- Users & Auth ----------
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });
  try {
    const user = await User.create({ name, email, password, role: role || "customer" });
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

app.post("/customerregister", async (req, res) => {
  const { name, email, password, role, location } = req.body;
  if (!name || !email || !password || !location)
    return res.status(400).json({ message: "All fields required" });
  try {
    const user = await customerUser.create({ name, email, password, role: role || "customer", location });
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

app.post("/Login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

app.post("/customerlogin", async (req, res) => {
  const { email, password, location } = req.body;
  try {
    const user = await customerUser.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });
    user.location = location || user.location;
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location, profileImage: user.profileImage },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

app.post("/adminLogin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await adminUser.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

app.post("/adminRegister", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });
  try {
    const user = await adminUser.create({ name, email, password });
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

app.get("/userLocation/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId).select("location");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ location: user.location });
  } catch (err) {
    res.status(500).json({ message: "Error fetching location", error: err.message });
  }
});

app.get("/user/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId).select("name email role profileImage location");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Error fetching user", error: err.message });
  }
});

app.get("/userInvoices/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId);
    if (!user || !user.location) return res.status(404).json({ message: "User or location not found" });
    const invoices = await invoice.find({ location: user.location });
    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ message: "Error fetching invoices", error: err.message });
  }
});

// ---------- Weekly Totals ----------
app.post("/weekly-total", async (req, res) => {
  const { folder, weekStart, total } = req.body;

  if (!folder || !weekStart || total === undefined) {
    return res.status(400).json({ success: false, message: "Invalid data" });
  }

  try {
    const updated = await WeeklyTotal.findOneAndUpdate(
      { folder, weekStart },
      { total, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.get("/weekly-total/:folder/:weekStart", async (req, res) => {
  const { folder, weekStart } = req.params;

  if (!folder || !weekStart) {
    return res.status(400).json({ success: false, message: "Missing params" });
  }

  try {
    const weekly = await WeeklyTotal.findOne({ folder, weekStart });

    if (!weekly) {
      return res.json({ success: true, total: 0 });
    }

    res.json({ success: true, total: weekly.total });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/weeklyTotal/:employeeId/:weekStart/:userId", async (req, res) => {
  const { employeeId, weekStart, userId } = req.params;
  try {
    const user = await customerUser.findById(userId);
    if (!user || !user.location) return res.json({ success: true, total: 0, bills: [] });
    const weekly = await WeeklyTotal.findOne({ employeeId, weekStart, folder: user.location });
    if (weekly) return res.json({ success: true, total: weekly.total, bills: weekly.bills });
    res.json({ success: true, total: 0, bills: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/weeklyTotalByUser/:userId/:weekStart", async (req, res) => {
  const { userId, weekStart } = req.params;
  if (!userId || !weekStart) return res.status(400).json({ success: false, message: "userId and weekStart required" });
  try {
    const user = await customerUser.findById(userId);
    if (!user || !user.location) return res.status(404).json({ success: false, message: "User or location not found" });
    const weekly = await WeeklyTotal.findOne({ folder: user.location, weekStart });
    res.json({ success: true, total: weekly ? weekly.total : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/weeklyTotal/folder/:folder/week/:weekStart", async (req, res) => {
  const { folder, weekStart } = req.params;
  if (!folder || !weekStart) return res.status(400).json({ success: false, message: "folder and weekStart required" });
  try {
    const results = await WeeklyTotal.find({ folder, weekStart });
    const total = results.reduce((sum, item) => sum + (item.total || 0), 0);
    res.json({ success: true, total, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- Weekly Pay ----------
app.post("/weekly-pay", async (req, res) => {
  const { location, weekStart, employeeId, employeeName, amount } = req.body;
  if (!location || !weekStart || !employeeId || amount === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const filter = { location, weekStart, employeeId };
    const update = { employeeName, amount };
    const updated = await WeeklyPay.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save employee pay" });
  }
});

app.get("/weekly-pay/:location/:weekStart", async (req, res) => {
  const { location, weekStart } = req.params;
  try {
    const records = await WeeklyPay.find({ location, weekStart });
    res.json({ success: true, data: records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employee pay" });
  }
});

app.get("/weekly-pay/:weekStart", async (req, res) => {
  try {
    const data = await WeeklyPay.find({ weekStart: req.params.weekStart });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Error fetching weekly pay" });
  }
});

app.post("/biometric/register", async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;

    if (!userId || !fingerprint) {
      return res.status(400).json({ message: "Missing data" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.biometric = fingerprint; // stored template
    await user.save();

    res.json({ message: "Biometric saved successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error saving biometric", error: err.message });
  }
});

// Biometric login
app.post("/biometric/login", async (req, res) => {
  try {
    const { userId, deviceToken } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.biometric) {
      return res.status(404).json({ message: "No biometric found" });
    }

    if (user.biometric !== deviceToken) {
      return res.status(400).json({ message: "Device not matched" });
    }

    const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "365d" });

    res.json({ message: "Login success", token, user });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
});


app.post("/face/register", async (req, res) => {
  try {
    const { userId, faceData } = req.body;

    if (!userId || !faceData) {
      return res.status(400).json({ message: "Missing data" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.faceId = faceData;
    await user.save();

    res.json({ message: "Face ID saved successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error saving face ID", error: err.message });
  }
});

// Face ID login
app.post("/face/login", async (req, res) => {
  try {
    const { userId, faceData } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.faceId) {
      return res.status(404).json({ message: "No face data found" });
    }

    if (user.faceId !== faceData) {
      return res.status(400).json({ message: "Face not matched" });
    }

    const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "365d" });

    res.json({ message: "Login success", token, user });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
});
// ==================== CUSTOMER BIOMETRIC ROUTES ====================

// Register biometric for a customer
app.post("/customer/biometric/register", async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;   // userId is customer's _id
    if (!userId || !fingerprint) {
      return res.status(400).json({ message: "Missing userId or fingerprint" });
    }

    const customer = await customerUser.findById(userId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.biometric = fingerprint;   // store device token
    await customer.save();

    res.json({ message: "Biometric registered successfully for customer" });
  } catch (err) {
    console.error("Customer biometric register error:", err);
    res.status(500).json({ message: "Error saving biometric", error: err.message });
  }
});

// Biometric login for customer
app.post("/customer/biometric/login", async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;
    if (!userId || !fingerprint) {
      return res.status(400).json({ message: "Missing userId or fingerprint" });
    }

    const customer = await customerUser.findById(userId);
    if (!customer || !customer.biometric) {
      return res.status(404).json({ message: "No biometric registered for this customer" });
    }

    if (customer.biometric !== fingerprint) {
      return res.status(400).json({ message: "Invalid biometric token" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: customer._id, role: customer.role || "customer" },
      "secretKey",
      { expiresIn: "365d" }
    );

    // Prepare response data (matches your customerlogin endpoint structure)
    const userData = {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
      location: customer.location,
      profileImage: customer.profileImage || "",
    };

    res.json({ message: "Login successful", token, user: userData });
  } catch (err) {
    console.error("Customer biometric login error:", err);
    res.status(500).json({ message: "Error logging in with biometric", error: err.message });
  }
});

// ==================== CUSTOMER FACE ID ROUTES ====================

// Register Face ID for a customer
app.post("/customer/face/register", async (req, res) => {
  try {
    const { userId, faceData } = req.body;
    if (!userId || !faceData) {
      return res.status(400).json({ message: "Missing userId or faceData" });
    }

    const customer = await customerUser.findById(userId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.faceId = faceData;
    await customer.save();

    res.json({ message: "Face ID registered successfully for customer" });
  } catch (err) {
    console.error("Customer Face ID register error:", err);
    res.status(500).json({ message: "Error saving Face ID", error: err.message });
  }
});

// Face ID login for customer
app.post("/customer/face/login", async (req, res) => {
  try {
    const { userId, faceData } = req.body;
    if (!userId || !faceData) {
      return res.status(400).json({ message: "Missing userId or faceData" });
    }

    const customer = await customerUser.findById(userId);
    if (!customer || !customer.faceId) {
      return res.status(404).json({ message: "No Face ID registered for this customer" });
    }

    if (customer.faceId !== faceData) {
      return res.status(400).json({ message: "Face ID mismatch" });
    }

    const token = jwt.sign(
      { id: customer._id, role: customer.role || "customer" },
      "secretKey",
      { expiresIn: "365d" }
    );

    const userData = {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
      location: customer.location,
      profileImage: customer.profileImage || "",
    };

    res.json({ message: "Login successful", token, user: userData });
  } catch (err) {
    console.error("Customer Face ID login error:", err);
    res.status(500).json({ message: "Error logging in with Face ID", error: err.message });
  }
});

// ==================== ADMIN BIOMETRIC ROUTES ====================

// Register biometric for an admin
app.post("/admin/biometric/register", async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;   // userId is admin's _id
    if (!userId || !fingerprint) {
      return res.status(400).json({ message: "Missing userId or fingerprint" });
    }

    const admin = await adminUser.findById(userId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.biometric = fingerprint;   // store device token
    await admin.save();

    res.json({ message: "Biometric registered successfully for admin" });
  } catch (err) {
    console.error("Admin biometric register error:", err);
    res.status(500).json({ message: "Error saving biometric", error: err.message });
  }
});

// Biometric login for admin
app.post("/admin/biometric/login", async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;
    if (!userId || !fingerprint) {
      return res.status(400).json({ message: "Missing userId or fingerprint" });
    }

    const admin = await adminUser.findById(userId);
    if (!admin || !admin.biometric) {
      return res.status(404).json({ message: "No biometric registered for this admin" });
    }

    if (admin.biometric !== fingerprint) {
      return res.status(400).json({ message: "Invalid biometric token" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role || "admin" },
      "secretKey",
      { expiresIn: "365d" }
    );

    // Prepare response data (matches your adminLogin endpoint structure)
    const userData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profileImage: admin.profileImage || "",
    };

    res.json({ message: "Login successful", token, user: userData });
  } catch (err) {
    console.error("Admin biometric login error:", err);
    res.status(500).json({ message: "Error logging in with biometric", error: err.message });
  }
});

// ==================== ADMIN FACE ID ROUTES ====================

// Register Face ID for admin
app.post("/admin/face/register", async (req, res) => {
  try {
    const { userId, faceData } = req.body;
    if (!userId || !faceData) {
      return res.status(400).json({ message: "Missing userId or faceData" });
    }

    const admin = await adminUser.findById(userId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.faceId = faceData;
    await admin.save();

    res.json({ message: "Face ID registered successfully for admin" });
  } catch (err) {
    console.error("Admin Face ID register error:", err);
    res.status(500).json({ message: "Error saving Face ID", error: err.message });
  }
});

// Face ID login for admin
app.post("/admin/face/login", async (req, res) => {
  try {
    const { userId, faceData } = req.body;
    if (!userId || !faceData) {
      return res.status(400).json({ message: "Missing userId or faceData" });
    }

    const admin = await adminUser.findById(userId);
    if (!admin || !admin.faceId) {
      return res.status(404).json({ message: "No Face ID registered for this admin" });
    }

    if (admin.faceId !== faceData) {
      return res.status(400).json({ message: "Face ID mismatch" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role || "admin" },
      "secretKey",
      { expiresIn: "365d" }
    );

    const userData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profileImage: admin.profileImage || "",
    };

    res.json({ message: "Login successful", token, user: userData });
  } catch (err) {
    console.error("Admin Face ID login error:", err);
    res.status(500).json({ message: "Error logging in with Face ID", error: err.message });
  }
});



// ---------- Attendance ----------
app.post("/attendance", async (req, res) => {
  const { employeeId, employeeName, date, status, location, projectLocation } = req.body;
  if (!employeeId || !date) return res.status(400).json({ message: "employeeId and date required" });
  let locationName = "";
  try {
    if (location && location.lat && location.lng) {
      const geoRes = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=AIzaSyAUR-Ob2riKDD6-iyKG8yuF5aLMvhq1pCo`
      );
      if (geoRes.data.results[0]) locationName = geoRes.data.results[0].formatted_address;
    }
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    let attendance = await Attendance.findOne({ employeeId, date: { $gte: start, $lte: end } });
    if (attendance) {
      attendance.status = status || attendance.status;
      attendance.location = locationName || attendance.location;
      attendance.projectLocation = projectLocation || attendance.projectLocation;
      await attendance.save();
      return res.json({ message: "Attendance updated", attendance });
    }
    attendance = new Attendance({
      employeeId,
      employeeName,
      date: start,
      status: status || "Not marked",
      location: locationName || "",
      projectLocation: projectLocation || "",
    });
    await attendance.save();
    res.status(201).json({ message: "Attendance created", attendance });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to mark attendance", error: err.message });
  }
});

app.get("/geocode", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ address: "" });
  try {
    const geoRes = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyAUR-Ob2riKDD6-iyKG8yuF5aLMvhq1pCo`
    );
    const address = geoRes.data.results[0]?.formatted_address || "";
    res.json({ address });
  } catch (err) {
    console.error(err);
    res.json({ address: "" });
  }
});

app.get("/attendance", async (req, res) => {
  const { date, projectLocation } = req.query;
  try {
    let query = {};
    if (projectLocation) query.projectLocation = projectLocation;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const attendanceData = await Attendance.find(query).sort({ date: -1 });
    const filteredData = await Promise.all(
      attendanceData.map(async (record) => {
        const employee = await Employee.findOne({ employeeName: record.employeeName });
        if (!employee) return null;
        return { ...record.toObject(), employeeDetails: employee };
      })
    );
    res.json(filteredData.filter((item) => item !== null));
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching attendance", error: err.message });
  }
});

app.get("/attendance/user", async (req, res) => {
  const { employeeId, date } = req.query;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });
  try {
    let query = { employeeId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const attendance = await Attendance.find(query).sort({ date: -1 });
    if (!attendance || attendance.length === 0)
      return res.status(404).json({ message: "No attendance found for this user" });
    res.json(attendance);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to fetch attendance", error: err.message });
  }
});

app.get("/customerattendance", async (req, res) => {
  const { date, employeeId, location } = req.query;
  try {
    let query = {};
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const data = await Attendance.find(query).sort({ date: -1 });
    res.json(data);
  } catch {
    res.status(500).json({ message: "Error fetching attendance" });
  }
});

// ---------- Employees ----------
app.post("/addEmployee", async (req, res) => {
  const { name, emailaddress, password, role, employeeId, designation, phoneNumber, dateOfBirth, joiningDate, salary, address, activeEmployee } = req.body;
  if (!name || !emailaddress || !password) return res.status(400).json({ message: "Name, email, and password are required" });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const employee = new Employee({
      employeeName: name,
      emailaddress,
      employeeId: employeeId || `EMP${Date.now()}`,
      designation: designation || "Staff",
      phoneNumber: phoneNumber || "N/A",
      dateOfBirth: dateOfBirth || "01-01-1990",
      joiningDate: joiningDate || new Date().toISOString().split("T")[0],
      salary: salary || 0,
      address: address || "Not provided",
      activeEmployee: activeEmployee ?? true,
      password,
      role: role || "user",
    });
    await employee.save({ session });
    const user = new User({ name, email: emailaddress, password, role: role || "user" });
    await user.save({ session });
    await session.commitTransaction();
    session.endSession();
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "365d" });
    res.status(201).json({ message: "Employee and user created successfully", employee, user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Add Employee Error:", err);
    res.status(500).json({ message: "Failed to add employee and user", error: err.message });
  }
});

app.get("/employees", async (req, res) => {
  const employees = await Employee.find();
  res.json(employees);
});

app.get("/employees/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to fetch employee", error: err.message });
  }
});

app.get("/employees/details/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let employee;
    if (mongoose.Types.ObjectId.isValid(id)) employee = await Employee.findById(id).lean();
    if (!employee) employee = await Employee.findOne({ employeeId: id }).lean();
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee", error: err.message });
  }
});

app.put("/employees/:id", async (req, res) => {
  try {
    const { employeeName, employeeId, designation, phoneNumber, dateOfBirth, joiningDate, salary, address, emailaddress, password } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    employee.employeeName = employeeName || employee.employeeName;
    employee.employeeId = employeeId || employee.employeeId;
    employee.designation = designation || employee.designation;
    employee.phoneNumber = phoneNumber || employee.phoneNumber;
    employee.dateOfBirth = dateOfBirth || employee.dateOfBirth;
    employee.joiningDate = joiningDate || employee.joiningDate;
    employee.salary = salary || employee.salary;
    employee.address = address || employee.address;
    employee.emailaddress = emailaddress || employee.emailaddress;
    employee.password = password || employee.password;
    await employee.save();
    res.json({ message: "Employee updated successfully", employee });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update employee", error: err.message });
  }
});

app.delete("/employees/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete employee", error: err.message });
  }
});

app.get("/getEmployeeByEmail/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const employee = await Employee.findOne({ emailaddress: email }).lean();
    const user = await User.findOne({ email }).lean();
    if (!employee || !user) return res.status(404).json({ message: "Employee not found in both collections" });
    const employeeDetails = {
      employeeId: employee.employeeId,
      name: employee.employeeName,
      email: employee.emailaddress,
      designation: employee.designation,
      phoneNumber: employee.phoneNumber,
      dateOfBirth: employee.dateOfBirth,
      joiningDate: employee.joiningDate,
      salary: employee.salary,
      address: employee.address,
      activeEmployee: employee.activeEmployee,
      role: user.role,
      userId: user._id,
    };
    res.status(200).json({ employeeDetails });
  } catch (err) {
    console.error("Fetch Employee Error:", err);
    res.status(500).json({ message: "Failed to fetch employee", error: err.message });
  }
});

// ---------- Profile Image APIs ----------
app.post("/profileImage", async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64 || imageBase64.length < 100) return res.status(400).json({ message: "Invalid user or image data" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.profileImagePublicId) await cloudinary.uploader.destroy(user.profileImagePublicId);
    const result = await cloudinary.uploader.upload(imageBase64, { folder: "profile_images" });
    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();
    res.json({ profileImage: user.profileImage });
  } catch (err) {
    console.error("Profile image upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

app.get("/profileImage/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "profileImage name email");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ profileImage: user.profileImage, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch profile image", error: err.message });
  }
});

app.delete("/profileImage/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.profileImagePublicId) await cloudinary.uploader.destroy(user.profileImagePublicId);
    user.profileImage = "";
    user.profileImagePublicId = "";
    await user.save();
    res.json({ message: "Profile image deleted" });
  } catch (err) {
    console.error("Delete profile image error:", err);
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
});

// ---------- Invoices ----------
app.post("/uploadInvoice", uploadInvoice);
app.get("/invoices/:employeeId", getInvoices);
app.get("/invoices-by-folders/:employeeId", getInvoicesByFolders);
app.get("/invoices-by-folders", getInvoicesByFoldersForLocation);
app.delete("/invoice/:invoiceId", deleteInvoice);
app.post("/create-folder", createFolder);
app.delete("/folder/:employeeId/:folderName", deleteFolder);
app.get("/folders/:employeeId", getFolders);
app.get("/all-invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("employeeId", "name email");
    const grouped = {};
    invoices.forEach((inv) => {
      const folder = inv.folder || "default";
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(inv);
    });
    res.json({ success: true, invoices: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ---------- MongoDB Connection ----------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));