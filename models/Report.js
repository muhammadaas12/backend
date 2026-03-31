// models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    workDescription: { type: String, required: true },
    projectId: String,
    media: { type: String },       // URL of image/video
    mediaType: { type: String }, 
    projectLocation: { type: String , required: true},  
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);