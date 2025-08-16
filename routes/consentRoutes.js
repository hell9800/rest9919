const express = require("express");
const router = express.Router();
const User = require("../models/userModel");

// Input validation middleware
const validateConsentInput = (req, res, next) => {
  const { phone, name, age, consent } = req.body;
     
  const errors = [];
     
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    errors.push('Valid phone number is required');
  }
     
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
     
  if (!age || typeof age !== 'number' || age < 18 || age > 100) {
    errors.push('Age must be between 18 and 100 years'); // Updated error message
  }
     
  if (typeof consent !== 'boolean') {
    errors.push('Consent must be true or false');
  }
     
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
     
  next();
};

router.post("/", validateConsentInput, async (req, res) => {
  const { phone, name, age, consent } = req.body;
 
  try {
    const user = await User.findOneAndUpdate(
      { phone: phone.trim() },
      {
        name: name.trim(),
        age: parseInt(age),
        consentGiven: consent
      },
      {
        new: true,
        upsert: false,
        select: '-otp -otpExpiresAt'
      }
    );
     
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please verify your phone number first."
      });
    }
     
    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        phone: user.phone,
        name: user.name,
        age: user.age,
        consentGiven: user.consentGiven
      }
    });
  } catch (error) {
    console.error("Consent update error:", error);
         
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }
         
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get user profile - Using query parameter
router.get("/profile", async (req, res) => {
  const { phone } = req.query;
     
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required as query parameter"
    });
  }
 
  try {
    const user = await User.findOne({ phone: phone.trim() }).select('-otp -otpExpiresAt');
         
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
         
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

module.exports = router;