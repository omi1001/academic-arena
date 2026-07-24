const verifyFirebaseToken = require('./verifyToken');
const User = require('../models/User');

const verifyAdmin = async (req, res, next) => {
  verifyFirebaseToken(req, res, async () => {
    try {
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      
      const user = await User.findOne({ uid: req.user.uid });
      
      const isEmailAdmin = req.user.email && adminEmails.includes(req.user.email.toLowerCase());
      const isRoleAdmin = user && user.role === 'admin';

      if (isEmailAdmin || isRoleAdmin) {
        req.adminUser = user;
        return next();
      }

      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    } catch (err) {
      console.error('Verify admin error:', err);
      return res.status(500).json({ error: 'Server authorization failure' });
    }
  });
};

module.exports = verifyAdmin;
