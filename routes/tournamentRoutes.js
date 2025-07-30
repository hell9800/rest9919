const express = require("express");
const router = express.Router();
const Tournament = require("../models/tournamentModel");
const User = require("../models/userModel");

// Input validation middleware
const validateTournamentData = (req, res, next) => {
  const requiredFields = ['gameType', 'title', 'startTime', 'entryFee', 'perKill', 'winningAmount', 'roomId', 'roomPassword'];
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!req.body[field]) {
      errors.push(`${field} is required`);
    }
  });
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors 
    });
  }
  
  next();
};

const validateRegistrationData = (req, res, next) => {
  const { phone, gameName, uid } = req.body;
  const errors = [];
  
  if (!phone || phone.trim().length === 0) {
    errors.push('Phone number is required');
  }
  
  if (!gameName || gameName.trim().length < 2) {
    errors.push('Game name must be at least 2 characters');
  }
  
  if (!uid || uid.trim().length === 0) {
    errors.push('UID is required');
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

// Create Tournament (admin use only)
router.post("/create", validateTournamentData, async (req, res) => {
  try {
    const tournamentData = {
      ...req.body,
      startTime: new Date(req.body.startTime)
    };
    
    const tournament = await Tournament.create(tournamentData);
    
    res.status(201).json({ 
      success: true, 
      message: "Tournament created successfully",
      tournament 
    });
  } catch (error) {
    console.error("Error creating tournament:", error);
    
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

// List All Tournaments with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { 
      gameType, 
      status = 'UPCOMING', 
      page = 1, 
      limit = 10,
      sortBy = 'startTime',
      sortOrder = 'asc'
    } = req.query;
    
    const filter = {};
    
    if (gameType) {
      filter.gameType = gameType;
    }
    
    if (status) {
      filter.status = status;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tournaments = await Tournament.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-players.phone'); // Hide phone numbers in list view
    
    const total = await Tournament.countDocuments(filter);
    
    res.json({
      success: true,
      tournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalTournaments: total,
        hasNext: skip + tournaments.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error listing tournaments:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Get Tournament by ID
router.get("/:id", async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: "Tournament not found" 
      });
    }
    
    res.json({
      success: true,
      tournament
    });
  } catch (error) {
    console.error("Error fetching tournament:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tournament ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Register for a Tournament
router.post("/register/:id", validateRegistrationData, async (req, res) => {
  const { phone, gameName, uid } = req.body;
  const tournamentId = req.params.id;

  try {
    // Check if user exists and has given consent
    const user = await User.findOne({ phone: phone.trim() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found. Please verify your phone number first." 
      });
    }
    
    if (!user.consentGiven) {
      return res.status(403).json({ 
        success: false, 
        message: "Please complete your profile and give consent first." 
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: "Tournament not found" 
      });
    }
    
    if (tournament.status !== 'UPCOMING') {
      return res.status(400).json({ 
        success: false, 
        message: "Registration is not available for this tournament" 
      });
    }
    
    if (tournament.isFull()) {
      return res.status(400).json({ 
        success: false, 
        message: "Tournament is full" 
      });
    }

    if (tournament.isUserRegistered(phone.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: "You are already registered for this tournament" 
      });
    }

    tournament.players.push({ 
      phone: phone.trim(), 
      gameName: gameName.trim(), 
      uid: uid.trim() 
    });
    
    await tournament.save();

    res.json({
      success: true,
      message: "Registration successful",
      tournament: {
        id: tournament._id,
        title: tournament.title,
        roomId: tournament.roomId,
        roomPassword: tournament.roomPassword,
        startTime: tournament.startTime
      }
    });
  } catch (error) {
    console.error("Error registering for tournament:", error);
    
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
      message: "Registration failed" 
    });
  }
});

// Get Tournaments joined by a user
router.get("/user/tournaments", async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ 
      success: false, 
      message: "Phone number is required" 
    });
  }

  try {
    const tournaments = await Tournament.find({
      players: { $elemMatch: { phone: phone.trim() } }
    }).sort({ startTime: -1 });

    const userTournaments = tournaments.map(tournament => {
      const userPlayer = tournament.players.find(p => p.phone === phone.trim());
      return {
        ...tournament.toObject(),
        userRegistration: userPlayer
      };
    });

    res.json({
      success: true,
      tournaments: userTournaments
    });
  } catch (error) {
    console.error("Error fetching user tournaments:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

module.exports = router;