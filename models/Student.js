const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  course: {
    type: String,
    required: true,
  },
  umri: { // Age
    type: Number,
    required: true,
  },
  gender: { // Gender
    type: String,
    required: true,
  },
  phone: { // Namba ya simu
    type: String,
  }
});

module.exports = mongoose.model("Student", studentSchema);