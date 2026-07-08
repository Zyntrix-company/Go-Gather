/**
 * Personal documents — user-scoped wrapper around the shared docs service.
 * parentType = 'user', parentId = the authenticated user's id.
 * Cap is config-driven — see UPLOAD_PERSONAL_DOC_MAX_COUNT in config/uploadLimits.js.
 */
const sharedDocs = require('../shared/docs/docs.service');
const { personalDocMaxCount } = require('../../config/uploadLimits');

const PARENT_TYPE = 'user';

const respondError = (res, next, e) => {
  if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
  return next(e);
};

const getDocs = async (req, res, next) => {
  try {
    const result = await sharedDocs.getDocs({ parentType: PARENT_TYPE, parentId: req.user.id });
    res.status(200).json({ ...result, maxCount: personalDocMaxCount });
  } catch (e) { next(e); }
};

const uploadDoc = async (req, res, next) => {
  try {
    const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one file is required', statusCode: 400 });
    }
    const result = await sharedDocs.uploadDocs(
      { parentType: PARENT_TYPE, parentId: req.user.id, maxCount: personalDocMaxCount },
      req.user.id,
      files,
    );
    res.status(201).json({ doc: result.docs[0] ?? null, docs: result.docs, total: result.total });
  } catch (e) { respondError(res, next, e); }
};

const renameDoc = async (req, res, next) => {
  try {
    const doc = await sharedDocs.renameDoc({
      docId: req.params.docId,
      parentType: PARENT_TYPE,
      parentId: req.user.id,
      requesterId: req.user.id,
      requesterRole: 'owner',
      newName: req.body.fileName,
    });
    res.status(200).json({ doc });
  } catch (e) { respondError(res, next, e); }
};

const replaceDoc = async (req, res, next) => {
  try {
    const file = req.files?.length ? req.files[0] : req.file;
    if (!file) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A file is required', statusCode: 400 });
    }
    const doc = await sharedDocs.replaceDoc({
      docId: req.params.docId,
      parentType: PARENT_TYPE,
      parentId: req.user.id,
      requesterId: req.user.id,
      requesterRole: 'owner',
      file,
    });
    res.status(200).json({ doc });
  } catch (e) { respondError(res, next, e); }
};

const deleteDoc = async (req, res, next) => {
  try {
    await sharedDocs.deleteDoc({
      docId: req.params.docId,
      parentType: PARENT_TYPE,
      parentId: req.user.id,
      requesterId: req.user.id,
      requesterRole: 'owner',
    });
    res.status(200).json({ success: true });
  } catch (e) { respondError(res, next, e); }
};

module.exports = { getDocs, uploadDoc, renameDoc, replaceDoc, deleteDoc };
