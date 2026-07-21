const express = require('express');
const router = express.Router();
const sanitize = require('mongo-sanitize');
const verifyFirebaseToken = require('../middleware/verifyToken');
const Run = require('../models/Run');
const User = require('../models/User');
const { EXP_PER_DIFFICULTY, COMBO_BONUS_PER_STREAK, MAX_COMBO_BONUS, MAX_DIFFICULTY } = require('../config/game');

// Maximum allowed run duration: 30 minutes
const MAX_RUN_DURATION_MS = 30 * 60 * 1000;
// Minimum time per answer (anti speed-hack): 2 seconds
const MIN_ANSWER_TIME_MS = 2000;

// POST /api/runs
// Server-authoritative run submission — recalculates EXP, validates integrity
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const {
      runId, class: cls, subject, score, expEarned,
      questionsAnswered, correctAnswers, maxStreak,
      highestDifficulty, heartsRemaining, startTime, status,
    } = req.body;

    // ─── 1. Validate required fields ───
    if (!runId || !cls || !subject || score == null || expEarned == null
      || questionsAnswered == null || correctAnswers == null || startTime == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numScore = parseInt(score);
    const numCorrect = parseInt(correctAnswers);
    const numAnswered = parseInt(questionsAnswered);
    const numExp = parseInt(expEarned);
    const numDifficulty = parseInt(highestDifficulty) || 1;
    const numStreak = parseInt(maxStreak) || 0;
    const numHearts = parseInt(heartsRemaining) || 0;
    const numStart = parseInt(startTime);
    const numCls = parseInt(cls);
    const runStatus = sanitize(status || 'completed');

    // ─── 2. Validate types and ranges ───
    if (numCls !== 9 && numCls !== 10) {
      return res.status(400).json({ error: 'Invalid class' });
    }
    const validSubjects = ['Mathematics', 'Science', 'English', 'Social Science'];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({ error: 'Invalid subject' });
    }
    if (numScore < 0 || numCorrect < 0 || numAnswered < 0 || numExp < 0) {
      return res.status(400).json({ error: 'Negative values not allowed' });
    }
    if (numDifficulty < 1 || numDifficulty > MAX_DIFFICULTY) {
      return res.status(400).json({ error: 'Invalid difficulty range' });
    }

    // ─── 3. Validate integrity ───
    // score must equal correctAnswers
    if (numScore !== numCorrect) {
      return res.status(400).json({ error: 'Score mismatch' });
    }
    // Can't answer more than total questions
    if (numCorrect > numAnswered) {
      return res.status(400).json({ error: 'Correct answers exceed total answered' });
    }
    // Run must have started recently (within last 30 min)
    const now = Date.now();
    if (now - numStart > MAX_RUN_DURATION_MS) {
      return res.status(400).json({ error: 'Run expired' });
    }
    // Can't start in the future
    if (numStart > now + 5000) {
      return res.status(400).json({ error: 'Invalid start time' });
    }

    // ─── 4. Server recalculates expected EXP ───
    // We use a simplified model: each correct answer earns base EXP scaled by difficulty
    // The client applies speed multipliers and combo bonuses — we cap the server EXP
    let serverExpectedEXP = 0;
    for (let d = 1; d <= Math.min(numDifficulty, MAX_DIFFICULTY); d++) {
      serverExpectedEXP += d * EXP_PER_DIFFICULTY;
    }
    // Add max combo bonus
    serverExpectedEXP += Math.min(numStreak * COMBO_BONUS_PER_STREAK, MAX_COMBO_BONUS);
    // Passive EXP (max 10 min at 5 EXP per 30s = 100 EXP)
    serverExpectedEXP += 100;

    // Accept client EXP if within 50% above server calculation (allows speed bonus)
    const maxAllowedEXP = Math.round(serverExpectedEXP * 1.5);
    const finalExp = Math.min(numExp, maxAllowedEXP);

    // ─── 5. Save the run ───
    const run = await Run.create({
      uid: req.user.uid,
      runId: sanitize(runId),
      class: numCls,
      subject: sanitize(subject),
      score: numScore,
      expEarned: finalExp,
      questionsAnswered: numAnswered,
      correctAnswers: numCorrect,
      maxStreak: numStreak,
      highestDifficulty: numDifficulty,
      heartsRemaining: numHearts,
      startTime: numStart,
      endTime: now,
      status: runStatus === 'cheat_detected' ? 'cheat_detected' : 'completed',
    });

    // ─── 6. Update user stats ───
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        $setOnInsert: {
          uid: req.user.uid,
          name: req.user.name || req.user.email?.split('@')[0] || 'Anonymous',
          email: req.user.email || '',
          class: numCls,
        },
        $inc: {
          totalEXP: finalExp,
          gamesPlayed: 1,
          totalCorrect: numCorrect,
          totalAnswered: numAnswered,
        },
        $max: {
          highestStreak: numStreak,
          highestDifficulty: numDifficulty,
        },
      },
      { upsert: true }
    );

    res.json({ run, expAwarded: finalExp });
  } catch (err) {
    console.error('Run save error:', err);
    res.status(500).json({ error: 'Failed to save run' });
  }
});

// GET /api/runs/recent
router.get('/recent', verifyFirebaseToken, async (req, res) => {
  try {
    const runs = await Run.find({ uid: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-__v')
      .lean();

    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

module.exports = router;
