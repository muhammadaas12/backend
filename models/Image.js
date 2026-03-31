// models/Image.js
const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
 user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  filename: String,
  path: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Image", imageSchema);