/**
 * Middleware: ensure the authenticated user has 'admin' role in the trip.
 *
 * Must be used AFTER tripMember middleware (which sets req.tripMember).
 */
const tripAdmin = (req, res, next) => {
  if (!req.tripMember) {
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'tripAdmin middleware requires tripMember middleware to run first',
      statusCode: 500,
    });
  }

  if (req.tripMember.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Only trip admins can perform this action',
      statusCode: 403,
    });
  }

  next();
};

module.exports = tripAdmin;
