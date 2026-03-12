const { verifyAccessToken } = require('../utils/token');
const logger = require('../utils/logger');

/**
 * Express middleware — verify Bearer JWT and attach decoded user to req.user.
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header',
      statusCode: 401,
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Access token has expired',
        statusCode: 401,
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid access token',
      statusCode: 401,
    });
  }
};

module.exports = authenticateJWT;
