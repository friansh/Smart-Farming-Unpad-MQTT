const mongoose = require("mongoose");

const heartbeatSchema = new mongoose.Schema(
  {
    device_id: String,
    firmware_version: String,
  },
  {
    timestamps: true,
  }
);

const heartbeat = mongoose.model("heartbeats", heartbeatSchema);

module.exports = heartbeat;
