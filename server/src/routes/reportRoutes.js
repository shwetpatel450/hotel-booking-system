const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Room = require("../models/Room");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", protect, authorize("admin"), async (req, res) => {
  try {
    const now = new Date();
    const [totalUsers, totalRooms, totalBookings, revenueStats] = await Promise.all([
      User.countDocuments(),
      Room.countDocuments(),
      Booking.countDocuments(),
      Booking.aggregate([
        {
          $match: {
            status: { $in: ["confirmed", "completed"] },
            checkOutDate: { $lte: now },
          },
        },
        { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } },
      ]),
    ]);

    res.json({
      totalUsers,
      totalRooms,
      totalBookings,
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to generate dashboard report" });
  }
});

module.exports = router;
