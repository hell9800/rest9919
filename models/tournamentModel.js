const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  gameName: {
    type: String,
    required: [true, 'Game name is required'],
    trim: true,
    minlength: [2, 'Game name must be at least 2 characters'],
    maxlength: [30, 'Game name cannot exceed 30 characters']
  },
  uid: {
    type: String,
    required: [true, 'UID is required'],
    trim: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  gameType: {
    type: String,
    required: [true, 'Game type is required'],
    enum: ['PUBG', 'FREE_FIRE', 'COD_MOBILE', 'BGMI'],
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Tournament title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Start time must be in the future'
    }
  },
  entryFee: {
    type: Number,
    required: [true, 'Entry fee is required'],
    min: [0, 'Entry fee cannot be negative']
  },
  perKill: {
    type: Number,
    required: [true, 'Per kill amount is required'],
    min: [0, 'Per kill amount cannot be negative']
  },
  winningAmount: {
    type: Number,
    required: [true, 'Winning amount is required'],
    min: [0, 'Winning amount cannot be negative']
  },
  maxPlayers: {
    type: Number,
    default: 100,
    min: [1, 'Minimum 1 player required'],
    max: [500, 'Maximum 500 players allowed']
  },
  roomId: {
    type: String,
    required: [true, 'Room ID is required'],
    trim: true
  },
  roomPassword: {
    type: String,
    required: [true, 'Room password is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING'
  },
  players: [playerSchema]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
tournamentSchema.index({ startTime: 1 });
tournamentSchema.index({ gameType: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ 'players.phone': 1 });

// Virtual for spots left
tournamentSchema.virtual('spotsLeft').get(function() {
  return this.maxPlayers - this.players.length;
});

// Virtual for total prize pool
tournamentSchema.virtual('totalPrizePool').get(function() {
  return this.entryFee * this.players.length;
});

// Method to check if tournament is full
tournamentSchema.methods.isFull = function() {
  return this.players.length >= this.maxPlayers;
};

// Method to check if user is registered
tournamentSchema.methods.isUserRegistered = function(phone) {
  return this.players.some(player => player.phone === phone);
};

// Pre-save middleware to update status based on time
tournamentSchema.pre('save', function(next) {
  const now = new Date();
  const tournamentStart = new Date(this.startTime);
  const tournamentEnd = new Date(tournamentStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration
  
  if (this.status === 'CANCELLED') {
    return next();
  }
  
  if (now < tournamentStart) {
    this.status = 'UPCOMING';
  } else if (now >= tournamentStart && now < tournamentEnd) {
    this.status = 'LIVE';
  } else {
    this.status = 'COMPLETED';
  }
  
  next();
});

module.exports = mongoose.model("Tournament", tournamentSchema);
