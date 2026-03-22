const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware: verify that the authenticated user is a member of the trip.
 *
 * Requires: req.user (set by authenticateJWT)
 * Expects:  req.params.id  (trip UUID)
 *
 * On success: attaches req.tripMember = { tripId, userId, role }
 * On failure:
 *   - 404 if trip does not exist
 *   - 403 if user is not a member
 */
const tripMember = async (req, res, next) => {
  const tripId = req.params.id || req.params.tripId;
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Trip ID is required',
      statusCode: 400,
    });
  }

  try {
    // Verify trip exists
    const tripResult = await query(
      'SELECT id FROM trips WHERE id = $1',
      [tripId],
    );

    if (tripResult.rowCount === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Trip not found',
        statusCode: 404,
      });
    }

    // Verify membership
    const memberResult = await query(
      'SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, userId],
    );

    if (memberResult.rowCount === 0) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this trip',
        statusCode: 403,
      });
    }

    req.tripMember = {
      tripId,
      userId,
      role: memberResult.rows[0].role,
    };

    next();
  } catch (error) {
    logger.error('tripMember middleware error', { error: error.message, tripId, userId });
    next(error);
  }
};

module.exports = tripMember;
