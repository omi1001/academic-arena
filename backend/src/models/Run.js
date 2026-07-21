const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    index: true,
  },
  runId: {
    type: String,
    required: true,
    unique: true,
  },
  class: {
    type: Number,
    required: true,
    enum: [9, 10],
  },
  subject: {
    type: String,
    required: true,
    enum: ['Mathematics', 'Science', 'English', 'Social Science'],
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  expEarned: {
    type: Number,
    required: true,
    min: 0,
  },
  questionsAnswered: {
    type: Number,
    required: true,
  },
  correctAnswers: {
    type: Number,
    required: true,
  },
  maxStreak: {
    type: Number,
    default: 0,
  },
  highestDifficulty: {
    type: Number,
    default: 1,
  },
  heartsRemaining: {
    type: Number,
    default: 0,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['completed', 'cheat_detected', 'timeout'],
    default: 'completed',
  },
}, { timestamps: true });

// Index for leaderboard queries
runSchema.index({ uid: 1, createdAt: -1 });
runSchema.index({ subject: 1, score: -1 });

module.exports = mongoose.model('Run', runSchema);
