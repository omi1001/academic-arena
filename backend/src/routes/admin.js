const express = require('express');
const router = express.Router();
const sanitize = require('mongo-sanitize');
const verifyAdmin = require('../middleware/verifyAdmin');
const User = require('../models/User');
const Question = require('../models/Question');
const Run = require('../models/Run');
const Reward = require('../models/Reward');

// Apply admin verification middleware to all routes in this router
router.use(verifyAdmin);

// ─── 1. Dashboard Overview Stats ───
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRuns = await Run.countDocuments();
    const totalQuestions = await Question.countDocuments();
    const pendingRewards = await Reward.countDocuments({ status: 'pending' });

    // Calculate current week top player
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyTop = await Run.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      {
        $group: {
          _id: '$uid',
          weeklyEXP: { $sum: '$expEarned' },
          runsPlayed: { $sum: 1 },
        },
      },
      { $sort: { weeklyEXP: -1 } },
      { $limit: 5 },
    ]);

    const uids = weeklyTop.map((w) => w._id);
    const users = await User.find({ uid: { $in: uids } }).select('uid name email upiId activeBorder badges').lean();
    const userMap = {};
    users.forEach((u) => { userMap[u.uid] = u; });

    const weeklyCandidates = weeklyTop.map((w, idx) => ({
      rank: idx + 1,
      uid: w._id,
      name: userMap[w._id]?.name || userMap[w._id]?.email?.split('@')[0] || 'Player',
      email: userMap[w._id]?.email || '',
      upiId: userMap[w._id]?.upiId || '',
      activeBorder: userMap[w._id]?.activeBorder || 'default',
      weeklyEXP: w.weeklyEXP,
      runsPlayed: w.runsPlayed,
    }));

    res.json({
      totalUsers,
      totalRuns,
      totalQuestions,
      pendingRewards,
      weeklyCandidates,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// ─── 2. Question Management (CRUD) ───

// GET /api/admin/questions
router.get('/questions', async (req, res) => {
  try {
    const { class: cls, subject, packet, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (cls) query.class = parseInt(cls);
    if (subject) query.subject = subject;
    if (packet) query.packet = parseInt(packet);
    if (search) {
      query.question = { $regex: sanitize(search), $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

const normalizeSubject = (sub) => {
  if (!sub) return 'Mathematics';
  const lower = sub.trim().toLowerCase();
  if (lower.includes('math')) return 'Mathematics';
  if (lower.includes('sci')) return 'Science';
  if (lower.includes('eng')) return 'English';
  if (lower.includes('soc') || lower.includes('sst')) return 'Social Science';
  return sub.trim();
};

// POST /api/admin/questions (Create question)
router.post('/questions', async (req, res) => {
  try {
    const { class: cls, subject, difficulty, question, options, answer, explanation, source, chapter, packet } = req.body;

    if (!cls || !subject || !difficulty || !question || !options || answer == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ error: 'Must provide exactly 4 options' });
    }

    const normSubject = normalizeSubject(subject);

    const newQuestion = await Question.create({
      class: parseInt(cls),
      subject: normSubject,
      difficulty: parseInt(difficulty),
      question: sanitize(question),
      options: options.map((o) => sanitize(o)),
      answer: parseInt(answer),
      explanation: explanation ? sanitize(explanation) : '',
      source: source ? sanitize(source) : 'NCERT',
      chapter: chapter ? sanitize(chapter) : '',
      packet: packet ? parseInt(packet) : 1,
    });

    res.status(201).json(newQuestion);
  } catch (err) {
    console.error('Create question error:', err);
    res.status(500).json({ error: err.message || 'Failed to create question' });
  }
});

// PUT /api/admin/questions/:id (Update question)
router.put('/questions/:id', async (req, res) => {
  try {
    const { class: cls, subject, difficulty, question, options, answer, explanation, source, chapter, packet } = req.body;

    const updatedData = {};
    if (cls != null) updatedData.class = parseInt(cls);
    if (subject != null) updatedData.subject = sanitize(subject);
    if (difficulty != null) updatedData.difficulty = parseInt(difficulty);
    if (question != null) updatedData.question = sanitize(question);
    if (options != null) updatedData.options = options.map((o) => sanitize(o));
    if (answer != null) updatedData.answer = parseInt(answer);
    if (explanation != null) updatedData.explanation = sanitize(explanation);
    if (source != null) updatedData.source = sanitize(source);
    if (chapter != null) updatedData.chapter = sanitize(chapter);
    if (packet != null) updatedData.packet = parseInt(packet);

    const q = await Question.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    if (!q) return res.status(404).json({ error: 'Question not found' });

    res.json(q);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', async (req, res) => {
  try {
    const deleted = await Question.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ─── 3. Rewards & UPI Payout Management ───

// GET /api/admin/rewards
router.get('/rewards', async (req, res) => {
  try {
    const rewards = await Reward.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// POST /api/admin/rewards/trigger-weekly
// Calculates top weekly player, awards glowing gold border & creates ₹10 UPI payout entry
router.post('/rewards/trigger-weekly', async (req, res) => {
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const winner = await Run.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      {
        $group: {
          _id: '$uid',
          weeklyEXP: { $sum: '$expEarned' },
        },
      },
      { $sort: { weeklyEXP: -1 } },
      { $limit: 1 },
    ]);

    if (winner.length === 0) {
      return res.status(400).json({ error: 'No user runs found for the past week' });
    }

    const topUid = winner[0]._id;
    const user = await User.findOne({ uid: topUid });
    if (!user) {
      return res.status(404).json({ error: 'Weekly champion user record not found' });
    }

    const weekLabel = `Week of ${new Date().toISOString().slice(0, 10)}`;

    // Create Reward record
    const reward = await Reward.create({
      uid: topUid,
      userName: user.name || user.email.split('@')[0],
      upiId: user.upiId || 'Not Provided',
      amount: 10,
      weekLabel,
      status: 'pending',
      rewardType: 'weekly_leaderboard_1st',
    });

    // Award glowing border and badge
    user.activeBorder = 'glowing_gold';
    if (!user.badges.includes('WEEKLY_CHAMPION_GOLD')) {
      user.badges.push('WEEKLY_CHAMPION_GOLD');
    }
    await user.save();

    res.json({
      message: 'Weekly reward successfully triggered!',
      winner: {
        uid: user.uid,
        name: user.name,
        weeklyEXP: winner[0].weeklyEXP,
        upiId: user.upiId,
      },
      reward,
    });
  } catch (err) {
    console.error('Trigger weekly reward error:', err);
    res.status(500).json({ error: 'Failed to trigger weekly reward' });
  }
});

// PATCH /api/admin/rewards/:id (Mark payout as paid or rejected)
router.patch('/rewards/:id', async (req, res) => {
  try {
    const { status, transactionId } = req.body;
    if (!['pending', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid reward status' });
    }

    const updateData = { status };
    if (transactionId) updateData.transactionId = sanitize(transactionId);
    if (status === 'paid') updateData.paidAt = new Date();

    const reward = await Reward.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    res.json(reward);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reward' });
  }
});

// ─── 4. User & Badge Management ───

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, limit = 30 } = req.query;
    const query = {};

    if (search) {
      const sanitized = sanitize(search);
      query.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
        { uid: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .sort({ totalEXP: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/grant-badge
router.post('/users/grant-badge', async (req, res) => {
  try {
    const { uid, activeBorder, badge, role, upiId } = req.body;

    if (!uid) return res.status(400).json({ error: 'User UID is required' });

    const user = await User.findOne({ uid: sanitize(uid) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (activeBorder && ['default', 'glowing_gold', 'neon_cyan', 'fire_ring'].includes(activeBorder)) {
      user.activeBorder = activeBorder;
    }

    if (badge && !user.badges.includes(badge)) {
      user.badges.push(badge);
    }

    if (role && ['user', 'admin'].includes(role)) {
      user.role = role;
    }

    if (upiId !== undefined) {
      user.upiId = sanitize(upiId);
    }

    await user.save();

    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user badges' });
  }
});

module.exports = router;
