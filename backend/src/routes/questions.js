const express = require('express');
const router = express.Router();
const sanitize = require('mongo-sanitize');
const Question = require('../models/Question');

// GET /api/questions
// Query params: class, subject, difficulty, packet, exclude (comma-separated IDs), limit
router.get('/', async (req, res) => {
  const { class: cls, subject, difficulty, packet, exclude, limit } = req.query;

  const targetLimit = parseInt(limit) || 10;
  const classNum = cls ? parseInt(sanitize(cls)) : null;
  const subjectStr = subject ? sanitize(subject) : null;
  const diffNum = difficulty ? parseInt(sanitize(difficulty)) : null;
  const packetNum = packet ? parseInt(sanitize(packet)) : null;

  const excludedIds = exclude
    ? exclude.split(',').map((id) => sanitize(id.trim())).filter(Boolean)
    : [];

  try {
    let questions = [];

    if (classNum && subjectStr) {
      // 1. If packet is specified, attempt to fetch from requested packet & difficulty
      if (packetNum) {
        const query1 = { class: classNum, subject: subjectStr, packet: packetNum };
        if (diffNum) query1.difficulty = diffNum;
        if (excludedIds.length > 0) query1._id = { $nin: excludedIds };

        questions = await Question.find(query1)
          .sort({ difficulty: 1 })
          .limit(targetLimit)
          .select('-__v')
          .lean();

        // Fallback within same packet if difficulty match was too strict
        if (questions.length < targetLimit && diffNum) {
          const currentIds = [...excludedIds, ...questions.map((q) => q._id.toString())];
          const fallbackPacketQuery = {
            class: classNum,
            subject: subjectStr,
            packet: packetNum,
            _id: { $nin: currentIds },
          };
          const needed = targetLimit - questions.length;
          const samePacketFallback = await Question.find(fallbackPacketQuery)
            .limit(needed)
            .select('-__v')
            .lean();
          questions = [...questions, ...samePacketFallback];
        }
      }

      // 2. If questions still < targetLimit, fetch from next packets in sequence for same class & subject
      if (questions.length < targetLimit) {
        const currentIds = [...excludedIds, ...questions.map((q) => q._id.toString())];
        const queryNextPackets = {
          class: classNum,
          subject: subjectStr,
          _id: { $nin: currentIds },
        };
        const needed = targetLimit - questions.length;
        const nextPacketsQuestions = await Question.find(queryNextPackets)
          .sort({ packet: 1, difficulty: 1 })
          .limit(needed)
          .select('-__v')
          .lean();
        questions = [...questions, ...nextPacketsQuestions];
      }

      // 3. If STILL empty (all questions in all packets completed), recycle pool from Packet 1
      if (questions.length === 0) {
        const recentIds = excludedIds.slice(-5);
        const recyclingQuery = { class: classNum, subject: subjectStr };
        if (recentIds.length > 0) recyclingQuery._id = { $nin: recentIds };

        questions = await Question.find(recyclingQuery)
          .sort({ packet: 1, difficulty: 1 })
          .limit(targetLimit)
          .select('-__v')
          .lean();
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

// GET /api/questions/packets
// Query params: class, subject
// Returns breakdown of packets for a given class & subject
router.get('/packets', async (req, res) => {
  const { class: cls, subject } = req.query;

  const classNum = cls ? parseInt(sanitize(cls)) : null;
  const subjectStr = subject ? sanitize(subject) : null;

  if (!classNum || !subjectStr) {
    return res.status(400).json({ error: 'class and subject are required' });
  }

  try {
    const packets = await Question.aggregate([
      { $match: { class: classNum, subject: subjectStr } },
      {
        $group: {
          _id: '$packet',
          count: { $sum: 1 },
          minDifficulty: { $min: '$difficulty' },
          maxDifficulty: { $max: '$difficulty' },
          chapters: { $addToSet: '$chapter' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      packets.map((p) => ({
        packet: p._id || 1,
        totalQuestions: p.count,
        minDifficulty: p.minDifficulty,
        maxDifficulty: p.maxDifficulty,
        chapters: p.chapters.filter(Boolean),
      }))
    );
  } catch (err) {
    console.error('Packets fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch packets' });
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
