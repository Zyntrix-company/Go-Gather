const service = require('./members.service');

const getMembers = async (req, res, next) => {
  try {
    const result = await service.getMembers(req.tripMember.tripId);
    res.status(200).json(result); // { members, total, adminCount }
  } catch (e) { next(e); }
};

const removeMember = async (req, res, next) => {
  try {
    await service.removeMember(req.tripMember.tripId, req.params.userId, req.user.id);
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = { getMembers, removeMember };
