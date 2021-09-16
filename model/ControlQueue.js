const mongoose = require("mongoose");

const controlQueueSchema = new mongoose.Schema(
  {
    control_id: String,
    value: String,
  },
  {
    timestamps: true,
  }
);

const controlQueue = mongoose.model("controlqueues", controlQueueSchema);

module.exports = controlQueue;
