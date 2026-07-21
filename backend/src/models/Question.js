const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
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
  difficulty: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: (v) => v.length === 4,
      message: 'Each question must have exactly 4 options',
    },
  },
  answer: {
    type: Number,
    required: true,
    min: 0,
    max: 3,
  },
  explanation: {
    type: String,
    default: '',
  },
  source: {
    type: String,
    default: 'NCERT',
  },
  chapter: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Index for fast querying by class, subject, difficulty
questionSchema.index({ class: 1, subject: 1, difficulty: 1 });

module.exports = mongoose.model('Question', questionSchema);
