const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema(
  {
    index_id: String,
    device_id: String,
    value: Number,
  },
  {
    timestamps: true,
  }
);

const dataset = mongoose.model("datasets", datasetSchema);

module.exports = dataset;
