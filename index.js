// server.js
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const axios = require("axios");




dotenv.config();

const User = require("./models/User");
const Employee = require("./models/employee");
const Attendance = require("./models/attendance");
const Report = require("./models/Report");
const Project = require("./models/Project"); // <-- added
const WeeklyTotal = require("./models/weeklytotal"); // <-- added
const AdminUser = require("./models/adminUser"); // <-- added
const Folder = require("./models/Folder"); // <-- added
const Invoice = require("./models/invoice"); // <-- added
const WeeklyPay = require("./models/weeklyPay");
const {
  uploadInvoice,
  getInvoices,
  getInvoicesByFolders,
  deleteInvoice,
  deleteFolder,
  createFolder,
  getFolders,
getInvoicesByFoldersForLocation


} = require("./controllers/invoiceCOntroller");
const customerUser = require("./models/customerUser");
const adminUser = require("./models/adminUser");
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

// ---------- Multer storage for report media ----------
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads/reports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: reportStorage });

// ---------- Reports ----------
app.post("/reports", async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      workDescription,
      file,          
      type,          
      projectId,
      projectLocation,
      mediaUrl,      
      mediaType,     
    } = req.body;

    // Validate required fields
    if (!employeeId || !employeeName || !workDescription || !projectLocation) {
      return res.status(400).json({
        message: "Employee info, work description, and project location are required.",
      });
    }

    let finalMediaUrl = null;
    let finalMediaType = null;

    // 1. If mediaUrl is provided (direct frontend upload), use it
    if (mediaUrl) {
      finalMediaUrl = mediaUrl;
      finalMediaType = mediaType;
    }
    // 2. Else if file is provided (base64), upload to Cloudinary on server
    else if (file) {
      if (type !== "image" && type !== "video") {
        return res.status(400).json({
          message: "Invalid media type. Must be 'image' or 'video'.",
        });
      }
      finalMediaType = type;
      const uploadResponse = await cloudinary.uploader.upload(file, {
        folder: "reports",
        resource_type: finalMediaType === "video" ? "video" : "image",
      });
      finalMediaUrl = uploadResponse.secure_url;
    }

    // Create report
    const report = new Report({
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      workDescription: workDescription.trim(),
      media: finalMediaUrl,
      mediaType: finalMediaType,
      projectId: projectId || null,
      projectLocation: projectLocation.trim(),
    });

    await report.save();
    res.status(201).json({ message: "Report created successfully", report });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create report", error: err.message });
  }
});

app.post("/saveWeeklyTotal", async (req, res) => {
  const { employeeId, folder, weekStart, bills, total } = req.body;

  if (!employeeId || !folder || !weekStart || !bills || bills.length !== 7 || total === undefined) {
    return res.status(400).json({ success: false, message: "Invalid data" });
  }

  try {
    // Update if exists, otherwise create new
    const updated = await Weekly.findOneAndUpdate(
      { employeeId, folder, weekStart },
      { bills, total, createdAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ success: true, weeklyTotal: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.get("/weeklyTotal/:employeeId/:folder/:weekStart", async (req, res) => {
  const { employeeId, folder, weekStart } = req.params;

  if (!employeeId || !folder || !weekStart) {
    return res.status(400).json({
      success: false,
      message: "employeeId, folder and weekStart required",
    });
  }

  try {
    const weekly = await WeeklyTotal.findOne({
      employeeId,
      folder,
      weekStart,
    });

    if (!weekly) {
      return res.json({
        success: true,
        total: 0,
        bills: [],
      });
    }

    res.json({
      success: true,
      total: weekly.total,
      bills: weekly.bills,
      weekStart: weekly.weekStart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
app.get("/weeklyTotal/:employeeId/:folder/:weekStart", async (req, res) => {
  const { employeeId, folder, weekStart } = req.params;

  if (!employeeId || !folder || !weekStart) {
    return res.status(400).json({
      success: false,
      message: "employeeId, folder, and weekStart required",
    });
  }

  try {
    // Find the employee to check their location
    const employee = await customerUser.findById(id).select("location");
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Compare employee location with the requesting user's location
    // You can get the requesting user from req.user if using auth middleware
    const requestingUserLocation = req.query.location; // pass ?location=... from frontend
    if (employee.location !== requestingUserLocation) {
      return res.json({ success: true, total: 0, bills: [] });
    }

    const weekly = await WeeklyTotal.findOne({
      employeeId,
      folder,
      weekStart,
    });

    if (!weekly) {
      return res.json({ success: true, total: 0, bills: [] });
    }

    res.json({
      success: true,
      total: weekly.total,
      bills: weekly.bills,
      weekStart: weekly.weekStart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
 // ensure this model exists

// Save total weekly pay for a location
app.post("/weekly-pay", async (req, res) => {
  const { location, weekStart, totalAmount } = req.body;
  if (!location || !weekStart || totalAmount === undefined) {
    return res.status(400).json({ error: "location, weekStart, and totalAmount required" });
  }
  try {
    const existing = await WeeklyPay.findOne({ location, weekStart });
    if (existing) {
      existing.totalAmount = totalAmount;
      await existing.save();
      return res.json({ success: true, weeklyPay: existing });
    }
    const newPay = new WeeklyPay({ location, weekStart, totalAmount });
    await newPay.save();
    res.json({ success: true, weeklyPay: newPay });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error saving weekly pay" });
  }
});

// Get weekly pay total for a location and week
app.get("/weekly-pay/:location/:weekStart", async (req, res) => {
  const { location, weekStart } = req.params;
  if (!location || !weekStart) {
    return res.status(400).json({ error: "location and weekStart required" });
  }
  try {
    const pay = await WeeklyPay.findOne({ location, weekStart });
    res.json({ success: true, totalAmount: pay ? pay.totalAmount : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching weekly pay" });
  }
});

// Get all reports (optionally project-wise)
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
    const { location } = req.query; // get user location from query
    if (!location) return res.status(400).json({ message: "location is required" });

    // Fetch all reports for the given location
    const reports = await Report.find({ projectLocation: location }).sort({ createdAt: -1 });

    res.json(reports); // send all reports for this location
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

// Get projects for a user
app.get("/projects", async (req, res) => {
  try {
    const { labourId } = req.query;
    const projects = await Project.find({ labourId });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch projects", error: err.message });
  }
});

// ---------- Users ----------
// server.js or auth routes
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  try {
    // Directly create the user without checking email
    const user = await User.create({ 
      name, 
      email, 
      password,
      role:  role || "customer"  // allow admin if explicitly set
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "secretKey",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        profileImage: user.profileImage,
        role: user.role
      },
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
    const user = await customerUser.create({ 
      name, 
      email, 
      password,
      role: role || "customer",
      location: location
    });

    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});
app.post("/customerlogin", async (req, res) => {
  const { email, password, location } = req.body;
  try {
    const user = await customerUser.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "7d" });

    // Update location on login
    user.location = location || user.location;
    await user.save();

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// ---------- Login ----------
app.post("/Login", async (req, res) => {
  const { email, password} = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "secretKey",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,          // <-- include role here
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});
app.post("/customerlogin", async (req, res) => {
  const { email, password} = req.body;
  try {
    const user = await customerUser.findOne({ email });
    if (!user || !(await customerUser.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "secretKey",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,          // <-- include role here
        profileImage: user.profileImage,
        location: user.location,   // <-- include location here

      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});
app.get("/userLocation/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId).select("location");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      location: user.location,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching location",
      error: err.message,
    });
  }
});
app.get("/user/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId).select(
      "name email role profileImage location"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching user",
      error: err.message,
    });
  }
});
app.get("/userInvoices/:userId", async (req, res) => {
  try {
    const user = await customerUser.findById(req.params.userId);

    if (!user || !user.location) {
      return res.status(404).json({ message: "User or location not found" });
    }

    const invoices = await invoice.find({
      location: user.location, // ✅ match string to string
    });

    res.json({ invoices });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching invoices",
      error: err.message,
    });
  }
});
app.get("/weeklyTotal/:employeeId/:weekStart/:userId", async (req, res) => {
  const { employeeId, weekStart, userId } = req.params;

  try {
    const user = await customerUser.findById(userId);

    if (!user || !user.location) {
      return res.json({ success: true, total: 0, bills: [] });
    }

    const weekly = await WeeklyTotal.findOne({
      employeeId: employeeId,
      weekStart: weekStart,
      folder: user.location, // match here
    });

    // ✅ If match → send total
    if (weekly) {
      return res.json({
        success: true,
        total: weekly.total,
        bills: weekly.bills,
      });
    }

    // ❌ If not match → return 0
    return res.json({
      success: true,
      total: 0,
      bills: [],
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// GET /weeklyTotalByUser/:userId/:weekStart
app.get("/weeklyTotalByUser/:userId/:weekStart", async (req, res) => {
  const { userId, weekStart } = req.params;

  if (!userId || !weekStart) {
    return res.status(400).json({ success: false, message: "userId and weekStart required" });
  }

  try {
    // 1. Get user location
    const user = await customerUser.findById(userId);
    if (!user || !user.location) {
      return res.status(404).json({ success: false, message: "User or location not found" });
    }

    // 2. Find weekly total by folder (location) and weekStart
    const weekly = await WeeklyTotal.findOne({
      folder: user.location,
      weekStart: weekStart, // make sure weekStart format matches DB
    });

    // 3. Return total
    if (!weekly) {
      return res.json({ success: true, total: 0 });
    }

    res.json({ success: true, total: weekly.total });
  } catch (err) {
    console.error("WeeklyTotalByUser Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.get("/customerattendance", async (req, res) => {
  const { date, employeeId, location } = req.query;

  try {
    let query = {};

    if (employeeId) query.employeeId = employeeId;

    if (location) query.location = location; // ✅ NEW

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






app.post("/adminLogin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await adminUser.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "secretKey",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,          // <-- include role here
        profileImage: user.profileImage,
      },
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

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "secretKey",
      { expiresIn: "7d" }
    );      

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
  
});

// ---------- Profile Image APIs ----------
// Profile Image APIs
app.post("/profileImage", async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64 || imageBase64.length < 100)
      return res.status(400).json({ message: "Invalid user or image data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete old image if exists
    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    // Upload new image
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "profile_images",
    });

    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    res.json({ profileImage: user.profileImage });
  } catch (err) {
    console.error("Profile image upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// Fetch profile image
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

    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    user.profileImage = "";
    user.profileImagePublicId = "";
    await user.save();

    res.json({ message: "Profile image deleted" });
  } catch (err) {
    console.error("Delete profile image error:", err);
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
});


// ---------- Employees ----------
app.post("/addEmployee", async (req, res) => {
  const {
    name,
    emailaddress,
    password,
    role,
    employeeId,
    designation,
    phoneNumber,
    dateOfBirth,
    joiningDate,
    salary,
    address,
    activeEmployee,
  } = req.body;

  if (!name || !emailaddress || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create Employee
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

    // Create User
    const user = new User({
      name,
      email: emailaddress,
      password,
      role: role || "user",
    });

    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Generate token
    const token = jwt.sign({ id: user._id, role: user.role }, "secretKey", { expiresIn: "7d" });

    res.status(201).json({
      message: "Employee and user created successfully",
      employee,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Add Employee Error:", err);
    res.status(500).json({ message: "Failed to add employee and user", error: err.message });
  }
});
app.get("/employees/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.json(employee); // send all employee fields
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/weekly-pay", async (req, res) => {
  const { location, weekStart, totalAmount } = req.body;

  try {
    const existing = await WeeklyPay.findOne({ location, weekStart });

    if (existing) {
      existing.totalAmount = totalAmount;
      await existing.save();
      return res.json(existing);
    }

    const newPay = new WeeklyPay({ location, weekStart, totalAmount });
    await newPay.save();

    res.json(newPay);
  } catch (err) {
    res.status(500).json({ error: "Error saving weekly pay" });
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
app.get("/getEmployeeByEmail/:email", async (req, res) => {
  const { email } = req.params;

  try {
    // Find employee and user by email
    const employee = await Employee.findOne({ emailaddress: email }).lean();
    const user = await User.findOne({ email }).lean();

    if (!employee || !user) {
      return res.status(404).json({ message: "Employee not found in both collections" });
    }

    // Combine data but exclude passwords
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

app.delete("/employees/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id); 
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete employee", error: err.message });
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

    // Check if id is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      employee = await Employee.findById(id).lean();
    }

    // If not found by _id, try employeeId
    if (!employee) {
      employee = await Employee.findOne({ employeeId: id }).lean();
    }

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(employee); // send all fields
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee", error: err.message });
  }
});
// Update employee by ID
app.put("/employees/:id", async (req, res) => {
  try {
    const { employeeName, employeeId, designation, phoneNumber, dateOfBirth, joiningDate, salary, address } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Update fields
    employee.employeeName = employeeName || employee.employeeName;
    employee.employeeId = employeeId || employee.employeeId;
    employee.designation = designation || employee.designation;
    employee.phoneNumber = phoneNumber || employee.phoneNumber;
    employee.dateOfBirth = dateOfBirth || employee.dateOfBirth;
    employee.joiningDate = joiningDate || employee.joiningDate;
    employee.salary = salary || employee.salary;
    employee.address = address || employee.address;
      employee.emailaddress = req.body.emailaddress || employee.emailaddress;
      employee.password = req.body.password || employee.password;

    await employee.save();
    res.json({ message: "Employee updated successfully", employee });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update employee", error: err.message });
  }
});
app.get("/weeklyTotal/folder/:folder/week/:weekStart", async (req, res) => {
  const { folder, weekStart } = req.params;
  if (!folder || !weekStart) {
    return res.status(400).json({ success: false, message: "folder and weekStart required" });
  }
  try {
    const results = await WeeklyTotal.find({ folder, weekStart });
    const total = results.reduce((sum, item) => sum + (item.total || 0), 0);
    res.json({ success: true, total, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- Attendance ----------
app.post("/attendance", async (req, res) => {
  const { employeeId, employeeName, date, status, location, projectLocation } = req.body;
  if (!employeeId || !date) return res.status(400).json({ message: "employeeId and date required" });

  let locationName = "";
  try {
    // Get address from coordinates if provided
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

    // Check if attendance already exists
    let attendance = await Attendance.findOne({ employeeId, date: { $gte: start, $lte: end } });

    if (attendance) {
      attendance.status = status || attendance.status;
      attendance.location = locationName || attendance.location;
      attendance.projectLocation = projectLocation || attendance.projectLocation;
      await attendance.save();
      return res.json({ message: "Attendance updated", attendance });
    }

    // Create new attendance
    attendance = new Attendance({
      employeeId,
      employeeName,
      date: start,
      status: status || "Not marked",
      location: locationName || "",
      projectLocation: projectLocation || "" // save project location
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

    // Fetch attendance
    const attendanceData = await Attendance.find(query).sort({ date: -1 });

    // Enrich with employee details only if name matches
    const filteredData = await Promise.all(
      attendanceData.map(async (record) => {
        const employee = await Employee.findOne({ employeeName: record.employeeName });
        if (!employee) return null; // skip if no match
        return {
          ...record.toObject(),
          employeeDetails: employee,
        };
      })
    );

    // Remove nulls (attendance without matching employee)
    res.json(filteredData.filter((item) => item !== null));
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching attendance", error: err.message });
  }
});
app.get("/attendance/user", async (req, res) => {
  const { employeeId, date } = req.query;

  if (!employeeId)
    return res.status(400).json({ message: "employeeId is required" });

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
app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
app.get("/all-invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("employeeId", "name email"); // populate user info
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


// Routes
app.post("/uploadInvoice", uploadInvoice);
app.get("/invoices/:employeeId", getInvoices);
app.get("/invoices-by-folders/:employeeId", getInvoicesByFolders);
// Pass user location as param
app.get("/invoices-by-folders", getInvoicesByFoldersForLocation);
app.delete("/invoice/:invoiceId", deleteInvoice);
app.post("/create-folder", createFolder); // NEW
app.delete("/folder/:employeeId/:folderName", deleteFolder);
app.get("/folders/:employeeId", getFolders);


// ---------- MongoDB ----------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// ---------- Start Server ----------
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));