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
// Get the authenticated user's profile
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select('-__v').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile
// Update name or class
router.put('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, class: cls } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (cls) {
      const classNum = parseInt(cls);
      if (classNum !== 9 && classNum !== 10) {
        return res.status(400).json({ error: 'class must be 9 or 10' });
      }
      update.class = classNum;
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
