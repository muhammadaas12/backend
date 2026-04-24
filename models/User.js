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

    location: { type: String, default: "" },

    // ---------- BIOMETRIC ----------
    biometricEnabled: { type: Boolean, default: false },

    biometricType: {
      type: String,
      enum: ["fingerprint", "faceid"],
      default: null,
    },
  },
  { timestamps: true } // ✅ adds createdAt, updatedAt
);

// ---------- HASH PASSWORD ----------
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// ---------- COMPARE PASSWORD ----------
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);