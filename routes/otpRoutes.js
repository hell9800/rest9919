const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/userModel");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post("/send", async (req, res) => {
  const { phone } = req.body;
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  try {
    await axios.post("https://api.gupshup.io/sm/api/v1/msg", null, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apikey: process.env.GUPSHUP_API_KEY,
      },
      params: {
        channel: "whatsapp",
        source: process.env.SOURCE_PHONE,
        destination: phone,
        message: `Your OTP is ${otp}`, // match your Gupshup approved template
        "src.name": "your_bot_name"
      }
    });

    await User.findOneAndUpdate(
      { phone },
      { phone, otp, otpExpiresAt: expiresAt },
      { upsert: true }
    );

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

router.post("/verify", async (req, res) => {
  const { phone, otp } = req.body;

  const user = await User.findOne({ phone }).select('+otp +otpExpiresAt');

  if (!user || user.otp !== otp || user.otpExpiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  res.json({ success: true, message: "OTP verified" });
});

module.exports = router;