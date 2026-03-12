const logger = require('../utils/logger');
const config = require('../config');

/**
 * Centralised error-handling middleware.
 * Must be registered LAST (after all routes).
 *
 * Response shape: { error, message, statusCode }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log server errors fully; client errors at warn level
  if (statusCode >= 500) {
    logger.error(message, { stack: err.stack, statusCode });
  } else {
    logger.warn(message, { statusCode });
  }

  res.status(statusCode).json({
    error: err.error || 'ServerError',
    message,
    statusCode,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
