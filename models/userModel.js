// models/userModel.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'], 
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [13, 'Minimum age is 13 years'],
    max: [100, 'Maximum age is 100 years']
  },
  otp: {
    type: String,
    select: false // Don't include in queries by default
  },
  otpExpiresAt: {
    type: Date,
    select: false
  },
  consentGiven: { 
    type: Boolean, 
    default: false 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better performance
userSchema.index({ phone: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for user display name
userSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.phone})`;
});

// Method to check if OTP is valid
userSchema.methods.isOTPValid = function(otp) {
  return this.otp === otp && this.otpExpiresAt > new Date();
};

module.exports = mongoose.model("User", userSchema);