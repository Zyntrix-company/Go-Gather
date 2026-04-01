const service = require('./emailDocs.service');

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

const connectEmail = async (req, res, next) => {
  try {
    const { provider } = req.params;
    // resolveProvider will throw 400 for unknown providers; let service handle it
    const { getAuthUrl } = require(`./providers/${provider === 'gmail' ? 'gmail' : 'outlook'}.provider`);
    const state = service.generateState(req.user.id);
    const authUrl = getAuthUrl(state);
    res.redirect(authUrl);
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
  const { code, state, error: oauthError } = req.query;
  if (oauthError || !code) {
    return res.redirect(deepLinkUrl('outlook', false, oauthError || 'NO_CODE'));
  }
  try {
    await service.handleOAuthCallback('outlook', code, state);
    res.redirect(deepLinkUrl('outlook', true));
  } catch (err) {
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
    const result = await service.importAttachments(req.user.id, req.tripMember.tripId, attachments);
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

module.exports = { connectEmail, googleCallback, microsoftCallback, getStatus, listAttachments, importAttachments, disconnect };
