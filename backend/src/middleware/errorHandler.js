// Global error handler middleware — must be registered last (after all routes)
// Never leak stack traces or DB errors to the client in production

const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
};

module.exports = errorHandler;
