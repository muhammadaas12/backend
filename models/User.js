const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    profileImage: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "" },
    role: { type: String, enum: ["user"], default: "user" },


    // Biometric fields
    biometric: { type: String, default: null },     // ✅ ADD THIS LINE
    faceId: { type: String, default: null },        // ✅ ADD THIS LINE
  },

);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);