const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyToken');
const User = require('../models/User');

// POST /api/auth/register
// Called after Firebase client creates the user (signup screen already does createUserWithEmailAndPassword)
// This endpoint saves/updates the profile in MongoDB
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

    // Upsert: create if not exists, update if exists
    const user = await User.findOneAndUpdate(
      { uid },
      {
        uid,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        class: classNum,
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
    let user = await User.findOne({ uid: req.user.uid }).select('-__v').lean();
    if (!user) {
      // Auto-create user profile from Firebase token info if missing
      const newUser = await User.create({
        uid: req.user.uid,
        name: req.user.name || req.user.email?.split('@')[0] || 'Player',
        email: req.user.email || `${req.user.uid}@academicarena.com`,
        class: 9,
      });
      user = newUser.toObject();
      delete user.__v;
    } else if (req.user.name && (user.name === 'Anonymous' || !user.name)) {
      // Heal profile name if previously Anonymous
      await User.updateOne({ uid: req.user.uid }, { $set: { name: req.user.name } });
      user.name = req.user.name;
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
