const { query: db } = require('../config/database');

/**
 * Verifies the authenticated user is a member of the given trip or event.
 * Reads parentType from req.params.parentType (or resolves from route param names).
 * Reads parentId from req.params.parentId, req.params.tripId, or req.params.eventId.
 * Attaches req.parent = { parentType, parentId, role } on success.
 *
 * Can also be used as a factory for a specific parentType:
 *   app.use(verifyParentAccess('trip'))  — parentId then read from :tripId
 */
const verifyParentAccess = (fixedParentType) => async (req, res, next) => {
  const parentType = fixedParentType
    || req.params.parentType
    || (req.params.tripId  ? 'trip'  : null)
    || (req.params.eventId ? 'event' : null);

  const parentId = req.params.parentId
    || req.params.tripId
    || req.params.eventId;

  // Personal (user-scoped) parent — the user's own document space.
  // parentId is always the authenticated user; any supplied value is ignored.
  if (parentType === 'user') {
    req.parent = { parentType: 'user', parentId: req.user.id, role: 'owner' };
    return next();
  }

  if (!['trip', 'event'].includes(parentType)) {
    return res.status(400).json({ error: 'INVALID_PARENT_TYPE', message: 'parentType must be trip, event, or user', statusCode: 400 });
  }
  if (!parentId) {
    return res.status(400).json({ error: 'MISSING_PARENT_ID', message: 'Parent ID is required', statusCode: 400 });
  }

  const table = parentType === 'trip' ? 'trip_members' : 'event_members';
  const col   = parentType === 'trip' ? 'trip_id'      : 'event_id';

  // Verify parent exists
  const parentTable = parentType === 'trip' ? 'trips' : 'events';
  const parentExists = await db(`SELECT 1 FROM ${parentTable} WHERE id = $1`, [parentId]);
  if (parentExists.rowCount === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: `${parentType.charAt(0).toUpperCase() + parentType.slice(1)} not found`, statusCode: 404 });
  }

  const member = await db(
    `SELECT role FROM ${table} WHERE ${col} = $1 AND user_id = $2`,
    [parentId, req.user.id],
  );

  if (!member.rows[0]) {
    return res.status(403).json({ error: 'NOT_A_MEMBER', message: `You are not a member of this ${parentType}`, statusCode: 403 });
  }

  req.parent = { parentType, parentId, role: member.rows[0].role };

  // Backward-compatibility: keep req.tripMember populated when parentType is 'trip'
  if (parentType === 'trip') {
    req.tripMember = { tripId: parentId, role: member.rows[0].role };
  }

  next();
};

module.exports = verifyParentAccess;
