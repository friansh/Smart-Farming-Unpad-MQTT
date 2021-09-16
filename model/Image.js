const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    dataset_id: String,
    device_id: String,
    file_name: String,
  },
  {
    timestamps: true,
  }
);

const Image = mongoose.model("images", imageSchema);

module.exports = Image;
