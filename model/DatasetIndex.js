const mongoose = require("mongoose");

const datasetIndexSchema = new mongoose.Schema(
  {
    user_id: String,
    name: String,
    description: String,
    type: String,
  },
  {
    timestamps: true,
  }
);

const datasetIndex = mongoose.model("datasetindexes", datasetIndexSchema);

module.exports = datasetIndex;
