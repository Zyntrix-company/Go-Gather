const service = require('./activities.service');

const createActivity = async (req, res, next) => {
  try {
    const act = await service.createActivity(req.tripMember.tripId, req.user.id, req.body);
    res.status(201).json({ activity: act });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    const act = await service.updateActivity(
      req.params.actId,
      req.tripMember.tripId,
      req.user.id,
      req.tripMember.role,
      req.body,
    );
    res.status(200).json({ activity: act });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    await service.deleteActivity(req.params.actId, req.tripMember.tripId, req.user.id, req.tripMember.role);
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const result = await service.getActivities(req.tripMember.tripId);
    res.status(200).json(result);
  } catch (e) { next(e); }
};

// ── Activity Photos ───────────────────────────────────────────

const uploadActivityPhotos = async (req, res, next) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one photo is required', statusCode: 400 });
    }
    const photos = await service.uploadActivityPhotos(
      req.tripMember.tripId,
      req.params.actId,
      req.user.id,
      files,
    );
    res.status(201).json({ photos });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode, limit: e.limit, current: e.current });
    next(e);
  }
};

const getActivityPhotos = async (req, res, next) => {
  try {
    const photos = await service.getActivityPhotos(req.tripMember.tripId, req.params.actId);
    res.status(200).json({ photos });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deleteActivityPhoto = async (req, res, next) => {
  try {
    await service.deleteActivityPhoto(
      req.tripMember.tripId,
      req.params.actId,
      req.params.photoId,
      req.user.id,
      req.tripMember.role,
    );
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = {
  createActivity,
  updateActivity,
  deleteActivity,
  getActivities,
  uploadActivityPhotos,
  getActivityPhotos,
  deleteActivityPhoto,
};
