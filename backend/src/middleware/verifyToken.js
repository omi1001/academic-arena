const admin = require('../config/firebase');

const verifyFirebaseToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const displayName =
      decodedToken.name ||
      decodedToken.displayName ||
      (decodedToken.email ? decodedToken.email.split('@')[0] : 'Player');

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: displayName,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyFirebaseToken;
