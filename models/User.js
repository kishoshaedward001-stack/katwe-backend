const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true // Inazuia watu wawili kutumia jina moja la mtumiaji
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: "User" // Watumiaji wapya wote wanakuwa User wa kawaida kiotomatiki
  }
}, { timestamps: true });

// HAPA NDIO SEHEMU YA MUHIMU SANA YA KUKAGUA:
module.exports = mongoose.model("User", UserSchema);