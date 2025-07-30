// index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("./config/db");
const cors = require("cors");
const bodyParser = require("body-parser");

// Import routes
const otpRoutes = require("./routes/otpRoutes");
const consentRoutes = require("./routes/consentRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Initialize express app
const app = express();

// Enhanced middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
console.log("Registering routes...");

app.use("/api/otp", otpRoutes);
console.log("✅ OTP routes registered");

app.use("/api/consent", consentRoutes);
console.log("✅ Consent routes registered");

app.use("/api/tournaments", tournamentRoutes);
console.log("✅ Tournament routes registered");

app.use("/api/admin", adminRoutes);
console.log("✅ Admin routes registered");

// FIXED: 404 handler - use a function instead of '*' pattern
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});