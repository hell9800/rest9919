const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/userModel");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post("/send", async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required"
    });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  try {
    // MSG91 OTP API call - Method 1: Using the dedicated OTP endpoint
    const msg91Response = await axios.post(
      `https://control.msg91.com/api/v5/otp`,
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: phone,
        authkey: process.env.MSG91_AUTH_KEY,
        otp: otp,
        otp_expiry: 5, // 5 minutes
        userip: req.ip || "127.0.0.1"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "authkey": process.env.MSG91_AUTH_KEY
        }
      }
    );

    console.log("MSG91 Response:", msg91Response.data);

    // Store OTP in database
    await User.findOneAndUpdate(
      { phone },
      { phone, otp, otpExpiresAt: expiresAt },
      { upsert: true }
    );

    res.json({ 
      success: true, 
      message: "OTP sent successfully",
      requestId: msg91Response.data.request_id // MSG91 provides request_id for tracking
    });

  } catch (error) {
    console.error("MSG91 OTP sending error:", error.response?.data || error.message);
    
    // If the OTP endpoint fails, try the SMS endpoint as fallback
    if (error.response?.status === 400 && error.response?.data?.message?.includes("missing message")) {
      console.log("Trying SMS API as fallback...");
      
      try {
        const smsResponse = await axios.post(
          `https://control.msg91.com/api/v5/flow/`,
          {
            template_id: process.env.MSG91_TEMPLATE_ID,
            short_url: "0",
            recipients: [
              {
                mobiles: phone,
                OTP: otp // This should match the variable name in your MSG91 template
              }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              "authkey": process.env.MSG91_AUTH_KEY
            }
          }
        );

        console.log("MSG91 SMS API Response:", smsResponse.data);

        // Store OTP in database
        await User.findOneAndUpdate(
          { phone },
          { phone, otp, otpExpiresAt: expiresAt },
          { upsert: true }
        );

        return res.json({ 
          success: true, 
          message: "OTP sent successfully via SMS API",
          requestId: smsResponse.data.request_id
        });

      } catch (smsError) {
        console.error("MSG91 SMS API also failed:", smsError.response?.data || smsError.message);
        // Continue to original error handling below
      }
    }
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      return res.status(500).json({ 
        success: false, 
        message: "Authentication failed with MSG91. Please check your auth key."
      });
    }
    
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        success: false, 
        message: error.response?.data?.message || "Invalid request to MSG91. Please check template configuration."
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP. Please try again."
    });
  }
});

router.post("/verify", async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({
      success: false,
      message: "Phone number and OTP are required"
    });
  }

  try {
    const user = await User.findOne({ phone }).select('+otp +otpExpiresAt');

    if (!user || user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid or expired OTP" 
      });
    }

    // Clear OTP after successful verification for security
    await User.findOneAndUpdate(
      { phone },
      { $unset: { otp: 1, otpExpiresAt: 1 } }
    );

    res.json({ 
      success: true, 
      message: "OTP verified successfully",
      user: {
        phone: user.phone,
        name: user.name,
        consentGiven: user.consentGiven
      }
    });

  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Resend OTP endpoint
router.post("/resend", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required"
    });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Send OTP via MSG91 - Try OTP endpoint first
    try {
      await axios.post(
        `https://control.msg91.com/api/v5/otp`,
        {
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: phone,
          authkey: process.env.MSG91_AUTH_KEY,
          otp: otp,
          otp_expiry: 5,
          userip: req.ip || "127.0.0.1"
        },
        {
          headers: {
            "Content-Type": "application/json",
            "authkey": process.env.MSG91_AUTH_KEY
          }
        }
      );
    } catch (otpError) {
      // Fallback to SMS API
      await axios.post(
        `https://control.msg91.com/api/v5/flow/`,
        {
          template_id: process.env.MSG91_TEMPLATE_ID,
          short_url: "0",
          recipients: [
            {
              mobiles: phone,
              OTP: otp
            }
          ]
        },
        {
          headers: {
            "Content-Type": "application/json",
            "authkey": process.env.MSG91_AUTH_KEY
          }
        }
      );
    }

    // Update OTP in database
    await User.findOneAndUpdate(
      { phone },
      { otp, otpExpiresAt: expiresAt }
    );

    res.json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (error) {
    console.error("OTP resend error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
});

module.exports = router;
