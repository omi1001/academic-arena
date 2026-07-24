const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  upiId: {
    type: String,
    default: '',
  },
  amount: {
    type: Number,
    default: 10,
  },
  weekLabel: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'rejected'],
    default: 'pending',
  },
  transactionId: {
    type: String,
    default: '',
  },
  rewardType: {
    type: String,
    default: 'weekly_leaderboard_1st',
  },
  paidAt: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
