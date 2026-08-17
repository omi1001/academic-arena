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
      mode, challengeDifficulty, isChallengeWin,
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

    const runMode = mode === 'challenge' ? 'challenge' : 'solo';
    const numChallengeDiff = parseInt(challengeDifficulty) || 1;
    const boolChallengeWin = Boolean(isChallengeWin);

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

    // ─── 3. S-Tier Anti-Cheat & Answer Verification ───
    let computedCorrect = numCorrect;
    let computedScore = numScore;
    let computedStreak = numStreak;
    let isCheatDetected = runStatus === 'cheat_detected';

    const { answers } = req.body;
    if (Array.isArray(answers) && answers.length > 0) {
      const Question = require('../models/Question');
      const qIds = answers.map((a) => a.questionId).filter(Boolean);
      const dbQuestions = await Question.find({ _id: { $in: qIds } }).select('_id answer difficulty').lean();
      const qMap = new Map(dbQuestions.map((q) => [q._id.toString(), q]));

      let realCorrect = 0;
      let currentStreak = 0;
      let peakStreak = 0;
      let suspiciousSpeedCount = 0;

      for (const item of answers) {
        const dbQ = qMap.get(item.questionId?.toString());
        if (dbQ) {
          if (item.timeTakenMs != null && item.timeTakenMs < 350) {
            suspiciousSpeedCount++;
          }
          if (item.selectedOption === dbQ.answer) {
            realCorrect++;
            currentStreak++;
            if (currentStreak > peakStreak) peakStreak = currentStreak;
          } else {
            currentStreak = 0;
          }
        }
      }

      // Check if robotic speed or spoofed score
      if (suspiciousSpeedCount >= 3 || realCorrect !== numCorrect) {
        isCheatDetected = true;
      }

      computedCorrect = realCorrect;
      computedScore = realCorrect;
      computedStreak = peakStreak;
    }

    if (computedCorrect > numAnswered) {
      return res.status(400).json({ error: 'Correct answers exceed total answered' });
    }

    const now = Date.now();
    let validStart = numStart;
    if (!validStart || validStart <= 0 || now - validStart > MAX_RUN_DURATION_MS || validStart > now + 5000) {
      validStart = now - 60000;
    }

    // ─── 4. Server recalculates expected EXP ───
    let serverExpectedEXP = 0;
    for (let d = 1; d <= Math.min(numDifficulty, MAX_DIFFICULTY); d++) {
      serverExpectedEXP += d * EXP_PER_DIFFICULTY;
    }
    serverExpectedEXP += Math.min(computedStreak * COMBO_BONUS_PER_STREAK, MAX_COMBO_BONUS);
    serverExpectedEXP += 100;

    // For challenge mode, allow higher bonus threshold
    const expMultiplierCap = runMode === 'challenge' ? 2.5 : 1.5;
    const maxAllowedEXP = Math.round(serverExpectedEXP * expMultiplierCap);
    let finalExp = isCheatDetected ? 0 : Math.min(numExp, maxAllowedEXP);

    // ─── 5. Check if run already saved (idempotent retry check) ───
    const existingRun = await Run.findOne({ runId: sanitize(runId) });

    // ─── 6. Upsert the run record ───
    const run = await Run.findOneAndUpdate(
      { runId: sanitize(runId) },
      {
        uid: req.user.uid,
        runId: sanitize(runId),
        class: numCls,
        subject: sanitize(subject),
        score: computedScore,
        expEarned: finalExp,
        questionsAnswered: numAnswered,
        correctAnswers: computedCorrect,
        maxStreak: computedStreak,
        highestDifficulty: numDifficulty,
        heartsRemaining: numHearts,
        startTime: validStart,
        endTime: now,
        status: isCheatDetected ? 'cheat_detected' : (runStatus === 'timeout' ? 'timeout' : 'completed'),
        mode: runMode,
        challengeDifficulty: numChallengeDiff,
        isChallengeWin: boolChallengeWin,
      },
      { upsert: true, new: true }
    );

    // ─── 7. Update user stats only if this run was not previously saved and not cheated ───
    if (!existingRun && !isCheatDetected) {
      const userName = req.user.name || req.user.email?.split('@')[0] || 'Player';
      const userUpdate = {
        $inc: {
          totalEXP: finalExp,
          gamesPlayed: 1,
          totalCorrect: computedCorrect,
          totalAnswered: numAnswered,
        },
        $max: {
          highestStreak: computedStreak,
          highestDifficulty: numDifficulty,
        },
        $setOnInsert: {
          uid: req.user.uid,
          email: req.user.email || '',
          class: numCls,
        },
      };

      if (runMode === 'challenge') {
        userUpdate.$inc.challengeGamesPlayed = 1;
        if (boolChallengeWin) {
          userUpdate.$inc.challengeWins = 1;
        } else {
          userUpdate.$inc.challengeLosses = 1;
        }
        userUpdate.$max.highestChallengeDifficulty = numChallengeDiff;
      }

      if (userName && userName !== 'Anonymous') {
        userUpdate.$set = { name: userName };
      } else {
        userUpdate.$setOnInsert.name = 'Player';
      }

      await User.findOneAndUpdate({ uid: req.user.uid }, userUpdate, {
        upsert: true,
        new: true,
      });
    }

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
