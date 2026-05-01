const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      enum: ["standard", "deluxe", "suite"],
      required: true,
    },
    pricePerNight: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    amenities: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
