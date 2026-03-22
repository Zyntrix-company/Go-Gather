const service = require('./docs.service');

const uploadDoc = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A file is required', statusCode: 400 });
    }
    const doc = await service.uploadDoc(req.tripMember.tripId, req.user.id, req.file);
    res.status(201).json({ doc });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getDocs = async (req, res, next) => {
  try {
    const result = await service.getDocs(req.tripMember.tripId);
    res.status(200).json(result); // { docs, total }
  } catch (e) { next(e); }
};

const deleteDoc = async (req, res, next) => {
  try {
    await service.deleteDoc(req.params.docId, req.tripMember.tripId, req.user.id, req.tripMember.role);
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = { uploadDoc, getDocs, deleteDoc };
