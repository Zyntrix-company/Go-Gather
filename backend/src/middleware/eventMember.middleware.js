const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware: verify that the authenticated user is a member of the event.
 *
 * Requires: req.user (set by authenticateJWT)
 * Expects:  req.params.eventId
 *
 * On success: attaches req.eventMember = { eventId, userId, role }
 * On failure:
 *   - 404 if event does not exist
 *   - 403 if user is not a member
 */
const eventMember = async (req, res, next) => {
  const eventId = req.params.eventId || req.params.id;
  const userId = req.user.id;

  if (!eventId) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Event ID is required',
      statusCode: 400,
    });
  }

  try {
    const eventResult = await query('SELECT id FROM events WHERE id = $1', [eventId]);

    if (eventResult.rowCount === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Event not found',
        statusCode: 404,
      });
    }

    const memberResult = await query(
      'SELECT role FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId],
    );

    if (memberResult.rowCount === 0) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this event',
        statusCode: 403,
      });
    }

    req.eventMember = {
      eventId,
      userId,
      role: memberResult.rows[0].role,
    };

    next();
  } catch (error) {
    logger.error('eventMember middleware error', { error: error.message, eventId, userId });
    next(error);
  }
};

module.exports = eventMember;
