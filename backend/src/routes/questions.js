const express = require('express');
const router = express.Router();
const sanitize = require('mongo-sanitize');
const Question = require('../models/Question');

// GET /api/questions
// Query params: class, subject, difficulty, exclude (comma-separated IDs), limit
router.get('/', async (req, res) => {
  const { class: cls, subject, difficulty, exclude, limit } = req.query;

  const targetLimit = parseInt(limit) || 10;
  const classNum = cls ? parseInt(sanitize(cls)) : null;
  const subjectStr = subject ? sanitize(subject) : null;
  const diffNum = difficulty ? parseInt(sanitize(difficulty)) : null;

  const excludedIds = exclude
    ? exclude.split(',').map((id) => sanitize(id.trim())).filter(Boolean)
    : [];

  const query = {};
  if (classNum) query.class = classNum;
  if (subjectStr) query.subject = subjectStr;
  if (diffNum) query.difficulty = diffNum;
  if (excludedIds.length > 0) query._id = { $nin: excludedIds };

  try {
    // 1. Fetch matching difficulty questions
    let questions = await Question.find(query).limit(targetLimit).select('-__v').lean();

    // 2. If fewer than requested items found, fallback to any difficulty for same class & subject
    if (questions.length < targetLimit && classNum && subjectStr) {
      const currentIds = [...excludedIds, ...questions.map((q) => q._id.toString())];
      const fallbackQuery = {
        class: classNum,
        subject: subjectStr,
        _id: { $nin: currentIds },
      };

      const remainingNeeded = targetLimit - questions.length;
      const fallbackQuestions = await Question.find(fallbackQuery)
        .limit(remainingNeeded)
        .select('-__v')
        .lean();

      questions = [...questions, ...fallbackQuestions];
    }

    // 3. If STILL empty (all database questions for class/subject were in exclude), recycle pool
    if (questions.length === 0 && classNum && subjectStr) {
      const recentIds = excludedIds.slice(-5);
      const recyclingQuery = { class: classNum, subject: subjectStr };
      if (recentIds.length > 0) recyclingQuery._id = { $nin: recentIds };

      questions = await Question.find(recyclingQuery)
        .limit(targetLimit)
        .select('-__v')
        .lean();
    }

    res.json(questions);
  } catch (err) {
    console.error('Questions fetch error:', err);
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
