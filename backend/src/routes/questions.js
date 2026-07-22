const express = require('express');
const router = express.Router();
const sanitize = require('mongo-sanitize');
const Question = require('../models/Question');

// GET /api/questions
// Query params: class, subject, difficulty, exclude (comma-separated IDs), limit
router.get('/', async (req, res) => {
  const { class: cls, subject, difficulty, exclude, limit } = req.query;

  const query = {};
  if (cls) query.class = parseInt(sanitize(cls));
  if (subject) query.subject = sanitize(subject);
  if (difficulty) query.difficulty = parseInt(sanitize(difficulty));

  if (exclude) {
    const ids = exclude.split(',').map((id) => sanitize(id.trim())).filter(Boolean);
    if (ids.length > 0) {
      query._id = { $nin: ids };
    }
  }

  try {
    const questions = await Question.find(query)
      .limit(parseInt(limit) || 10)
      .select('-__v')
      .lean();

    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// GET /api/questions/count
// Returns question count per class+subject for the dashboard
router.get('/count', async (req, res) => {
  try {
    const counts = await Question.aggregate([
      {
        $group: {
          _id: { class: '$class', subject: '$subject', difficulty: '$difficulty' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.class': 1, '_id.subject': 1, '_id.difficulty': 1 } },
    ]);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to count questions' });
  }
});

// POST /api/questions/seed
// Bulk insert questions from the data/questions.js file
router.post('/seed', async (req, res) => {
  try {
    const questions = require('../../../data/questions');

    if (!questions || questions.length === 0) {
      return res.json({ message: 'No questions to seed', count: 0 });
    }

    await Question.deleteMany({});
    const result = await Question.insertMany(questions);

    res.json({ message: 'Seeding complete', count: result.length });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Failed to seed questions' });
  }
});

module.exports = router;
