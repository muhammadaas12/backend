const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  name: { type: String, required: true },
});

module.exports = mongoose.model("Folder", folderSchema);