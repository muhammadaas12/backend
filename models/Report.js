// models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    workDescription: { type: String, required: true },
    projectLocation: { type: String, required: true },
    media: { type: String },       // Cloudinary URL for image/video
    mediaType: { type: String },   // "image" or "video"
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);