/**
 * Requires the authenticated user to be an admin of the parent trip/event.
 * Must run AFTER verifyParentAccess (requires req.parent to be set).
 */
const requireParentAdmin = (req, res, next) => {
  if (!req.parent) {
    return res.status(500).json({ error: 'MIDDLEWARE_ORDER', message: 'requireParentAdmin must run after verifyParentAccess', statusCode: 500 });
  }
  if (req.parent.role !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_REQUIRED', message: 'Only admins can perform this action', statusCode: 403 });
  }
  next();
};

module.exports = requireParentAdmin;
