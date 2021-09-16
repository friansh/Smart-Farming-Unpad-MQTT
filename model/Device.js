const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    user_id: String,
    name: String,
    description: String,
    token: String,
  },
  {
    timestamps: true,
  }
);

const Device = mongoose.model("devices", deviceSchema);

module.exports = Device;
