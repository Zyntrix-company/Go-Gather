const service = require('./photos.service');

const uploadPhotos = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one photo is required', statusCode: 400 });
    }
    const photos = await service.uploadPhotos(req.tripMember.tripId, req.user.id, req.files);
    res.status(201).json({ photos });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getPhotos = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const result = await service.getPhotos(req.tripMember.tripId, { page: parseInt(page), limit: parseInt(limit) });
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const deletePhoto = async (req, res, next) => {
  try {
    await service.deletePhoto(req.params.photoId, req.tripMember.tripId, req.user.id, req.tripMember.role);
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = { uploadPhotos, getPhotos, deletePhoto };
