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

  try {
    let questions = [];

    if (classNum && subjectStr) {
      // 1. Fetch matching class, subject, difficulty
      if (diffNum) {
        const query1 = { class: classNum, subject: subjectStr, difficulty: diffNum };
        if (excludedIds.length > 0) query1._id = { $nin: excludedIds };
        questions = await Question.find(query1).limit(targetLimit).select('-__v').lean();
      }

      // 2. If fewer than targetLimit found, fallback to any difficulty for same class & subject
      if (questions.length < targetLimit) {
        const currentIds = [...excludedIds, ...questions.map((q) => q._id.toString())];
        const query2 = {
          class: classNum,
          subject: subjectStr,
          _id: { $nin: currentIds },
        };
        const needed = targetLimit - questions.length;
        const fallbackSameClass = await Question.find(query2)
          .limit(needed)
          .select('-__v')
          .lean();
        questions = [...questions, ...fallbackSameClass];
      }

      // 3. If STILL fewer than targetLimit (e.g. all class 9 questions completed), fetch from opposite class (e.g. Class 10)
      if (questions.length < targetLimit) {
        const otherClass = classNum === 9 ? 10 : 9;
        const currentIds = [...excludedIds, ...questions.map((q) => q._id.toString())];
        const query3 = {
          class: otherClass,
          subject: subjectStr,
          _id: { $nin: currentIds },
        };
        const needed = targetLimit - questions.length;
        const fallbackOtherClass = await Question.find(query3)
          .limit(needed)
          .select('-__v')
          .lean();
        questions = [...questions, ...fallbackOtherClass];
      }

      // 4. If STILL empty (all database questions for both classes completed), recycle pool
      if (questions.length === 0) {
        const recentIds = excludedIds.slice(-5);
        const recyclingQuery = { class: classNum, subject: subjectStr };
        if (recentIds.length > 0) recyclingQuery._id = { $nin: recentIds };

        questions = await Question.find(recyclingQuery)
          .limit(targetLimit)
          .select('-__v')
          .lean();

        if (questions.length === 0) {
          const otherClass = classNum === 9 ? 10 : 9;
          const recyclingQueryOther = { class: otherClass, subject: subjectStr };
          if (recentIds.length > 0) recyclingQueryOther._id = { $nin: recentIds };

          questions = await Question.find(recyclingQueryOther)
            .limit(targetLimit)
            .select('-__v')
            .lean();
        }
      }
    } else {
      const queryGen = {};
      if (excludedIds.length > 0) queryGen._id = { $nin: excludedIds };
      questions = await Question.find(queryGen).limit(targetLimit).select('-__v').lean();
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
