
const mongoose = require("mongoose");

const FolderWeeklyTotalSchema = new mongoose.Schema({
  folder: { type: String, required: true },
  weekStart: { type: String, required: true }, // YYYY-MM-DD
  total: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure one total per folder per week
FolderWeeklyTotalSchema.index({ folder: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model("FolderWeeklyTotal", FolderWeeklyTotalSchema);