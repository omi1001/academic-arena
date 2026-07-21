const express = require('express');
const router = express.Router();
const Run = require('../models/Run');
const User = require('../models/User');

// GET /api/leaderboard
// Query params: subject, class, limit (default 50)
router.get('/', async (req, res) => {
  const { subject, class: cls, limit: lim } = req.query;

  try {
    // If we have user names cached, use a faster approach
    // Aggregate runs, then look up user names
    const pipeline = [];
    const match = {};
    if (subject) match.subject = subject;
    if (cls) match.class = parseInt(cls);
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push(
      {
        $group: {
          _id: '$uid',
          totalEXP: { $sum: '$expEarned' },
          gamesPlayed: { $sum: 1 },
          totalCorrect: { $sum: '$correctAnswers' },
          totalAnswered: { $sum: '$questionsAnswered' },
          maxStreak: { $max: '$maxStreak' },
          highestDifficulty: { $max: '$highestDifficulty' },
        },
      },
      {
        $addFields: {
          accuracy: {
            $cond: [
              { $eq: ['$totalAnswered', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalAnswered'] }, 100] }, 1] },
            ],
          },
        },
      },
      { $sort: { totalEXP: -1 } },
      { $limit: parseInt(lim) || 50 }
    );

    const leaderboard = await Run.aggregate(pipeline);

    // Look up user names
    const uids = leaderboard.map((e) => e._id);
    const users = await User.find({ uid: { $in: uids } })
      .select('uid name class')
      .lean();

    const userMap = {};
    users.forEach((u) => { userMap[u.uid] = u; });

    const result = leaderboard.map((entry, index) => ({
      rank: index + 1,
      uid: entry._id,
      name: userMap[entry._id]?.name || 'Anonymous',
      class: userMap[entry._id]?.class || null,
      totalEXP: entry.totalEXP,
      gamesPlayed: entry.gamesPlayed,
      accuracy: entry.accuracy,
      maxStreak: entry.maxStreak,
      highestDifficulty: entry.highestDifficulty,
    }));

    res.json(result);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
