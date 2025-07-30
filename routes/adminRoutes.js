const express = require("express");
const router = express.Router();
const Tournament = require("../models/tournamentModel");
const User = require("../models/userModel");
const { Parser } = require("json2csv");

// Dashboard Stats with enhanced metrics
router.get("/stats", async (req, res) => {
  try {
    const [
      totalTournaments,
      totalUsers,
      upcomingTournaments,
      liveTournaments,
      completedTournaments,
      tournaments
    ] = await Promise.all([
      Tournament.countDocuments(),
      User.countDocuments(),
      Tournament.countDocuments({ status: 'UPCOMING' }),
      Tournament.countDocuments({ status: 'LIVE' }),
      Tournament.countDocuments({ status: 'COMPLETED' }),
      Tournament.find().select('entryFee players')
    ]);

    const totalEarnings = tournaments.reduce((sum, tournament) => {
      return sum + (tournament.entryFee * tournament.players.length);
    }, 0);

    const totalRegistrations = tournaments.reduce((sum, tournament) => {
      return sum + tournament.players.length;
    }, 0);

    const averagePlayersPerTournament = totalTournaments > 0 
      ? Math.round(totalRegistrations / totalTournaments) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalTournaments,
        totalUsers,
        totalEarnings,
        totalRegistrations,
        averagePlayersPerTournament,
        tournamentsByStatus: {
          upcoming: upcomingTournaments,
          live: liveTournaments,
          completed: completedTournaments
        }
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching dashboard stats" 
    });
  }
});

// Get all users with pagination
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    const filter = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-otp -otpExpiresAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalUsers: total
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching users" 
    });
  }
});

// Get players in specific tournament
router.get("/tournament/:id/players", async (req, res) => {
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
      tournament: {
        id: tournament._id,
        title: tournament.title,
        gameType: tournament.gameType,
        totalPlayers: tournament.players.length,
        maxPlayers: tournament.maxPlayers
      },
      players: tournament.players
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tournament ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Error fetching players" 
    });
  }
});

// Export players of a tournament as CSV
router.get("/tournament/:id/export", async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: "Tournament not found" 
      });
    }

    const fields = [
      { label: 'Phone', value: 'phone' },
      { label: 'Game Name', value: 'gameName' },
      { label: 'UID', value: 'uid' },
      { label: 'Registered At', value: 'registeredAt' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(tournament.players);

    const filename = `${tournament.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_players.csv`;

    res.header("Content-Type", "text/csv");
    res.attachment(filename);
    return res.send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tournament ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to export CSV" 
    });
  }
});

// Update tournament status
router.patch("/tournament/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid status" 
      });
    }
    
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: "Tournament not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Tournament status updated successfully",
      tournament
    });
  } catch (error) {
    console.error("Error updating tournament status:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating tournament status" 
    });
  }
});

module.exports = router;