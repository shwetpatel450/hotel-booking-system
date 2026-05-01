const express = require("express");
const ContactMessage = require("../models/ContactMessage");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch contact messages." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required." });
    }

    const saved = await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      message: String(message).trim(),
    });

    res.status(201).json({
      message: "Message received successfully. Our team will contact you shortly.",
      id: saved._id,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to submit message." });
  }
});

module.exports = router;
