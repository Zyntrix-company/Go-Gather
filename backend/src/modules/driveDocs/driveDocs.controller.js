const service = require('./driveDocs.service');
const driveProvider = require('../emailDocs/providers/drive.provider');
const logger = require('../../utils/logger');

const DEEP_LINK_BASE = 'gathergo://email-connected';

function deepLinkUrl(success, error) {
  const params = new URLSearchParams({ provider: 'drive', success: String(success) });
  if (error) params.set('error', error);
  return `${DEEP_LINK_BASE}?${params.toString()}`;
}

function handleError(err, res, next) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.error, message: err.message, statusCode: err.statusCode });
  next(err);
}

// GET /auth/drive/connect-url — returns { url } JSON for mobile app
const getConnectUrl = async (req, res, next) => {
  try {
    const state = service.generateState(req.user.id);
    const url   = driveProvider.getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    handleError(err, res, next);
  }
};

// GET /auth/drive/callback — Google redirects here after Drive consent
const driveCallback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  if (oauthError || !code) {
    return res.redirect(deepLinkUrl(false, oauthError || 'NO_CODE'));
  }
  try {
    await service.handleOAuthCallback(code, state);
    res.redirect(deepLinkUrl(true));
  } catch (err) {
    logger.error('Drive OAuth callback error:', err.message);
    res.redirect(deepLinkUrl(false, err.error || 'UNKNOWN_ERROR'));
  }
};

// DELETE /auth/drive/disconnect
const disconnect = async (req, res, next) => {
  try {
    await service.disconnect(req.user.id);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res, next);
  }
};

// GET /drive-docs/status
const getStatus = async (req, res, next) => {
  try {
    const status = await service.getStatus(req.user.id);
    res.json(status);
  } catch (err) {
    handleError(err, res, next);
  }
};

// GET /drive-docs/files?folderId=...
const listFiles = async (req, res, next) => {
  try {
    const { folderId, kind } = req.query;
    const photosOnly = kind === 'photos';
    const result = await service.listFiles(req.user.id, folderId || null, { photosOnly });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

// POST /drive-docs/import
const importFiles = async (req, res, next) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'files must be a non-empty array', statusCode: 400 });
    }
    const { parentType, parentId } = req.parent;
    const result = await service.importFiles(req.user.id, parentType, parentId, files);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

const importPhotos = async (req, res, next) => {
  try {
    const { files, target } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'files must be a non-empty array', statusCode: 400 });
    }
    const { parentType, parentId } = req.parent;
    const result = await service.importPhotos(req.user.id, parentType, parentId, files, { target });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

module.exports = { getConnectUrl, driveCallback, disconnect, getStatus, listFiles, importFiles, importPhotos };
