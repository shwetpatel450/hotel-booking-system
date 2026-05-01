const express = require("express");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const TAX_RATE = 0.12;
const SERVICE_FEE_RATE = 0.05;
const COUPON_DISCOUNT_RATE = 0.1;
const VALID_COUPON = "SAVE10";

function nightsBetween(checkInDate, checkOutDate) {
  const ms = new Date(checkOutDate) - new Date(checkInDate);
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

router.get("/", protect, async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };
    const bookings = await Booking.find(filter).populate("user room").sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

router.post("/", protect, authorize("user"), async (req, res) => {
  try {
    const { room: roomId, checkInDate, checkOutDate, guests, couponCode } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (guests > room.capacity) {
      return res.status(400).json({ message: "Guest count exceeds room capacity" });
    }

    const totalNights = nightsBetween(checkInDate, checkOutDate);
    if (totalNights <= 0) {
      return res.status(400).json({ message: "Invalid check-in/check-out dates" });
    }

    const overlappingBooking = await Booking.findOne({
      room: roomId,
      status: { $in: ["confirmed", "completed"] },
      checkInDate: { $lt: new Date(checkOutDate) },
      checkOutDate: { $gt: new Date(checkInDate) },
    });

    if (overlappingBooking) {
      return res.status(400).json({ message: "Room is not available for selected dates" });
    }

    const subtotal = totalNights * room.pricePerNight;
    const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
    const serviceFee = Number((subtotal * SERVICE_FEE_RATE).toFixed(2));
    const normalizedCoupon = (couponCode || "").trim().toUpperCase();
    const discountAmount =
      normalizedCoupon === VALID_COUPON
        ? Number((subtotal * COUPON_DISCOUNT_RATE).toFixed(2))
        : 0;
    const totalPrice = Number((subtotal + taxAmount + serviceFee - discountAmount).toFixed(2));

    const booking = await Booking.create({
      user: req.user._id,
      room: roomId,
      checkInDate,
      checkOutDate,
      guests,
      nights: totalNights,
      subtotal,
      taxAmount,
      serviceFee,
      discountAmount,
      couponCode: normalizedCoupon,
      totalPrice,
    });

    const populated = await booking.populate("user room");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id/status", protect, authorize("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate("user room");

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed to cancel this booking" });
    }

    const now = new Date();
    if (new Date(booking.checkOutDate) <= now) {
      if (booking.status !== "completed") {
        booking.status = "completed";
        await booking.save();
      }
      return res
        .status(400)
        .json({ message: "Cannot cancel booking after checkout date. Stay is completed." });
    }

    booking.status = "cancelled";
    await booking.save();
    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid booking id" });
  }
});

module.exports = router;
