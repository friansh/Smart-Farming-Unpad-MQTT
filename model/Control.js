const mongoose = require("mongoose");

const controlSchema = new mongoose.Schema(
  {
    control_id: String,
    device_id: String,
  },
  {
    timestamps: true,
  }
);

const control = mongoose.model("controls", controlSchema);

module.exports = control;
