/**
 * Middleware: require the authenticated user to be an admin of the event.
 * Must be used AFTER eventMember middleware (which sets req.eventMember).
 */
const eventAdmin = (req, res, next) => {
  if (!req.eventMember) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Event membership not verified',
      statusCode: 403,
    });
  }

  if (req.eventMember.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Only event admins can perform this action',
      statusCode: 403,
    });
  }

  next();
};

module.exports = eventAdmin;
