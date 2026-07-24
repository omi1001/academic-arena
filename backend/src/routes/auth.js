const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyToken');
const User = require('../models/User');

const isAdminEmail = (email) => {
  if (!email) return false;
  const adminList = ['monusingh2646@gmail.com', 'monus@gmail.com'];
  const envList = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  return [...adminList, ...envList].includes(email.toLowerCase());
};

// POST /api/auth/register
// Called after Firebase client creates the user
router.post('/register', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, email, class: cls } = req.body;
    const uid = req.user.uid;

    if (!name || !email || !cls) {
      return res.status(400).json({ error: 'name, email, and class are required' });
    }

    const classNum = parseInt(cls);
    if (classNum !== 9 && classNum !== 10) {
      return res.status(400).json({ error: 'class must be 9 or 10' });
    }

    const role = isAdminEmail(email) ? 'admin' : 'user';
    const activeBorder = isAdminEmail(email) ? 'glowing_gold' : 'default';

    const user = await User.findOneAndUpdate(
      { uid },
      {
        uid,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        class: classNum,
        role,
        activeBorder,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).select('-__v');

    res.json({ user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// GET /api/auth/profile
// Get the authenticated user's profile (auto-creates if missing)
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    let user = await User.findOne({ uid: req.user.uid }).select('-__v');
    const userEmail = req.user.email || user?.email || '';

    if (!user) {
      const role = isAdminEmail(userEmail) ? 'admin' : 'user';
      const activeBorder = isAdminEmail(userEmail) ? 'glowing_gold' : 'default';
      user = await User.create({
        uid: req.user.uid,
        name: req.user.name || userEmail.split('@')[0] || 'Player',
        email: userEmail || `${req.user.uid}@academicarena.com`,
        class: 9,
        role,
        activeBorder,
      });
    } else {
      let needsSave = false;
      if (isAdminEmail(userEmail) && user.role !== 'admin') {
        user.role = 'admin';
        user.activeBorder = 'glowing_gold';
        needsSave = true;
      }
      if (req.user.name && (user.name === 'Anonymous' || !user.name)) {
        user.name = req.user.name;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile
// Update name, class, upiId, activeBorder
router.put('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, class: cls, upiId, activeBorder } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (cls) {
      const classNum = parseInt(cls);
      if (classNum !== 9 && classNum !== 10) {
        return res.status(400).json({ error: 'class must be 9 or 10' });
      }
      update.class = classNum;
    }
    if (upiId !== undefined) {
      update.upiId = upiId.trim();
    }
    if (activeBorder && ['default', 'glowing_gold', 'neon_cyan', 'fire_ring'].includes(activeBorder)) {
      update.activeBorder = activeBorder;
    }

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      update,
      { new: true }
    ).select('-__v');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
