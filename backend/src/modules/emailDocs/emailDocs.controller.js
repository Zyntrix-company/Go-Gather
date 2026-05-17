const service = require('./emailDocs.service');
const logger  = require('../../utils/logger');

const DEEP_LINK_BASE = 'gathergo://email-connected';

function deepLinkUrl(provider, success, error) {
  const params = new URLSearchParams({ provider, success: String(success) });
  if (error) params.set('error', error);
  return `${DEEP_LINK_BASE}?${params.toString()}`;
}

function handleError(err, res, next) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.error, message: err.message, statusCode: err.statusCode });
  next(err);
}

// GET /auth/email/:provider/connect  — redirect flow (browser-based, not for mobile WebView)
const connectEmail = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { getAuthUrl } = require(`./providers/${provider === 'gmail' ? 'gmail' : 'outlook'}.provider`);
    const state = service.generateState(req.user.id);
    const authUrl = getAuthUrl(state);
    res.redirect(authUrl);
  } catch (err) {
    handleError(err, res, next);
  }
};

// GET /auth/email/:provider/connect-url  — returns { url } JSON for mobile app
// Mobile calls this via axios (JWT in header), then opens the URL with Linking.openURL()
// This avoids the disallowed_useragent error Google throws inside WebViews.
const getConnectUrl = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { getAuthUrl } = require(`./providers/${provider === 'gmail' ? 'gmail' : 'outlook'}.provider`);
    const state = service.generateState(req.user.id);
    const url = getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    handleError(err, res, next);
  }
};

const googleCallback = async (req, res, next) => {
  const { code, state, error: oauthError } = req.query;
  if (oauthError || !code) {
    return res.redirect(deepLinkUrl('gmail', false, oauthError || 'NO_CODE'));
  }
  try {
    await service.handleOAuthCallback('gmail', code, state);
    res.redirect(deepLinkUrl('gmail', true));
  } catch (err) {
    res.redirect(deepLinkUrl('gmail', false, err.error || 'UNKNOWN_ERROR'));
  }
};

const microsoftCallback = async (req, res, next) => {
  const { code, state, error: oauthError, error_description } = req.query;
  if (oauthError || !code) {
    logger.warn(`Microsoft OAuth callback error: ${oauthError} — ${error_description}`);
    return res.redirect(deepLinkUrl('outlook', false, oauthError || 'NO_CODE'));
  }
  try {
    await service.handleOAuthCallback('outlook', code, state);
    logger.info('Microsoft OAuth connected successfully');
    res.redirect(deepLinkUrl('outlook', true));
  } catch (err) {
    logger.error(`Microsoft token exchange failed: ${err.error} — ${err.message}`);
    res.redirect(deepLinkUrl('outlook', false, err.error || 'UNKNOWN_ERROR'));
  }
};

const getStatus = async (req, res, next) => {
  try {
    const status = await service.getStatus(req.user.id);
    res.json(status);
  } catch (err) {
    handleError(err, res, next);
  }
};

const listAttachments = async (req, res, next) => {
  try {
    const { provider } = req.query;
    if (!provider) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'provider query param is required', statusCode: 400 });
    }
    const result = await service.listAttachments(req.user.id, provider);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

const importAttachments = async (req, res, next) => {
  try {
    const { attachments } = req.body;
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'attachments must be a non-empty array', statusCode: 400 });
    }
    const { parentType, parentId } = req.parent;
    const result = await service.importAttachments(req.user.id, parentType, parentId, attachments);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

const disconnect = async (req, res, next) => {
  try {
    const { provider } = req.params;
    await service.disconnect(req.user.id, provider);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res, next);
  }
};

module.exports = { connectEmail, getConnectUrl, googleCallback, microsoftCallback, getStatus, listAttachments, importAttachments, disconnect };
