const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  class: {
    type: Number,
    required: true,
    enum: [9, 10],
  },
  totalEXP: {
    type: Number,
    default: 0,
  },
  gamesPlayed: {
    type: Number,
    default: 0,
  },
  totalCorrect: {
    type: Number,
    default: 0,
  },
  totalAnswered: {
    type: Number,
    default: 0,
  },
  highestStreak: {
    type: Number,
    default: 0,
  },
  highestDifficulty: {
    type: Number,
    default: 1,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  upiId: {
    type: String,
    default: '',
    trim: true,
  },
  badges: {
    type: [String],
    default: [],
  },
  activeBorder: {
    type: String,
    enum: ['default', 'glowing_gold', 'neon_cyan', 'fire_ring'],
    default: 'default',
  },
}, { timestamps: true });

userSchema.index({ totalEXP: -1 });

module.exports = mongoose.model('User', userSchema);

