const express = require('express');
const router = express.Router();
const Run = require('../models/Run');
const User = require('../models/User');

const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

// GET /api/leaderboard
// Query params: type ('weekly' | 'total', default 'weekly'), subject, class, limit (default 50)
router.get('/', async (req, res) => {
  const { type = 'weekly', subject, class: cls, limit: lim } = req.query;
  const targetLimit = parseInt(lim) || 50;

  try {
    if (type === 'challenge') {
      const query = {};
      if (cls) query.class = parseInt(cls);

      const users = await User.find(query)
        .sort({ highestChallengeDifficulty: -1, challengeWins: -1, totalEXP: -1 })
        .limit(targetLimit)
        .select('uid name email class totalEXP gamesPlayed challengeWins challengeLosses challengeGamesPlayed highestChallengeDifficulty activeBorder badges avatar')
        .lean();

      const result = users.map((u, index) => {
        let displayName = u.name;
        if (!displayName || displayName === 'Anonymous') {
          displayName = u.email ? u.email.split('@')[0] : 'Player';
        }

        return {
          rank: index + 1,
          uid: u.uid,
          name: displayName,
          class: u.class || null,
          exp: u.totalEXP,
          totalEXP: u.totalEXP,
          challengeWins: u.challengeWins || 0,
          challengeLosses: u.challengeLosses || 0,
          challengeGamesPlayed: u.challengeGamesPlayed || 0,
          highestChallengeDifficulty: u.highestChallengeDifficulty || 1,
          activeBorder: u.activeBorder || 'default',
          badges: u.badges || [],
          avatar: u.avatar || '🎓',
        };
      });

      return res.json(result);
    } else if (type === 'weekly') {
      const startOfWeek = getStartOfWeek();
      const match = { createdAt: { $gte: startOfWeek } };
      if (subject) match.subject = subject;
      if (cls) match.class = parseInt(cls);

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: '$uid',
            weeklyEXP: { $sum: '$expEarned' },
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
        { $sort: { weeklyEXP: -1 } },
        { $limit: targetLimit },
      ];

      const leaderboard = await Run.aggregate(pipeline);

      const uids = leaderboard.map((e) => e._id);
      const users = await User.find({ uid: { $in: uids } })
        .select('uid name email class activeBorder badges avatar totalEXP')
        .lean();

      const userMap = {};
      users.forEach((u) => { userMap[u.uid] = u; });

      const result = leaderboard.map((entry, index) => {
        const u = userMap[entry._id];
        let displayName = u?.name;
        if (!displayName || displayName === 'Anonymous') {
          displayName = u?.email ? u.email.split('@')[0] : 'Player';
        }

        return {
          rank: index + 1,
          uid: entry._id,
          name: displayName,
          class: u?.class || null,
          exp: entry.weeklyEXP,
          weeklyEXP: entry.weeklyEXP,
          totalEXP: u?.totalEXP || entry.weeklyEXP,
          gamesPlayed: entry.gamesPlayed,
          accuracy: entry.accuracy,
          maxStreak: entry.maxStreak,
          highestDifficulty: entry.highestDifficulty,
          activeBorder: u?.activeBorder || 'default',
          badges: u?.badges || [],
          avatar: u?.avatar || '🎓',
        };
      });

      return res.json(result);
    } else {
      // All-time (Total) Leaderboard
      const query = {};
      if (cls) query.class = parseInt(cls);

      const users = await User.find(query)
        .sort({ totalEXP: -1 })
        .limit(targetLimit)
        .select('uid name email class totalEXP gamesPlayed totalCorrect totalAnswered highestStreak highestDifficulty activeBorder badges avatar')
        .lean();

      const result = users.map((u, index) => {
        let displayName = u.name;
        if (!displayName || displayName === 'Anonymous') {
          displayName = u.email ? u.email.split('@')[0] : 'Player';
        }
        const accuracy = u.totalAnswered > 0
          ? Math.round((u.totalCorrect / u.totalAnswered) * 100)
          : 0;

        return {
          rank: index + 1,
          uid: u.uid,
          name: displayName,
          class: u.class || null,
          exp: u.totalEXP,
          totalEXP: u.totalEXP,
          gamesPlayed: u.gamesPlayed || 0,
          accuracy,
          maxStreak: u.highestStreak || 0,
          highestDifficulty: u.highestDifficulty || 1,
          activeBorder: u.activeBorder || 'default',
          badges: u.badges || [],
          avatar: u.avatar || '🎓',
        };
      });

      return res.json(result);
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
