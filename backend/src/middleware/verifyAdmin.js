const verifyFirebaseToken = require('./verifyToken');
const User = require('../models/User');

const verifyAdmin = async (req, res, next) => {
  verifyFirebaseToken(req, res, async () => {
    try {
      const defaultAdminEmails = ['monusingh2646@gmail.com', 'monus@gmail.com'];
      const envAdminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      const adminEmails = [...new Set([...defaultAdminEmails, ...envAdminEmails])];
      
      const user = await User.findOne({ uid: req.user.uid });
      const userEmail = (req.user.email || user?.email || '').toLowerCase();
      
      const isEmailAdmin = userEmail && adminEmails.includes(userEmail);
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
