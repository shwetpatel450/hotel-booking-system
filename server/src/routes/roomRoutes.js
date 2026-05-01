const express = require("express");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { type, minPrice, maxPrice, guests, checkInDate, checkOutDate, onlyAvailable } = req.query;
    const query = {};

    if (type) query.type = type;
    if (minPrice || maxPrice) {
      query.pricePerNight = {};
      if (minPrice) query.pricePerNight.$gte = Number(minPrice);
      if (maxPrice) query.pricePerNight.$lte = Number(maxPrice);
    }
    if (guests) query.capacity = { $gte: Number(guests) };

    const rooms = await Room.find(query).sort({ roomNumber: 1 });

    let blockedRoomIds = new Set();
    const hasDateRange = checkInDate && checkOutDate;

    if (hasDateRange) {
      const overlapBookings = await Booking.find({
        status: { $in: ["confirmed", "completed"] },
        checkInDate: { $lt: new Date(checkOutDate) },
        checkOutDate: { $gt: new Date(checkInDate) },
      }).select("room");
      blockedRoomIds = new Set(overlapBookings.map((b) => b.room.toString()));
    }

    const withAvailability = rooms.map((room) => {
      const isAvailableForDates = hasDateRange
        ? room.isAvailable && !blockedRoomIds.has(room._id.toString())
        : room.isAvailable;

      return {
        ...room.toObject(),
        isAvailableForDates,
      };
    });

    const filtered = onlyAvailable === "true"
      ? withAvailability.filter((room) => room.isAvailableForDates)
      : withAvailability;

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (error) {
    res.status(400).json({ message: "Invalid room id" });
  }
});

router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json({ message: "Room removed successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid room id" });
  }
});

module.exports = router;
