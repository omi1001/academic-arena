require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Routes
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const runRoutes = require('./routes/runs');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');

const app = express();

// ─── Global Middleware ───
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(logger);

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  message: { error: 'Too many requests, try again later.' },
});
app.use('/api', limiter);

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ─── Error Handler (must be last) ───
app.use(errorHandler);

// ─── Start Server ───
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;
