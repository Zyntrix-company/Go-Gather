const { Router } = require('express');
const authenticateJWT    = require('../../middleware/authenticate');
const verifyParentAccess = require('../../middleware/parentAccess.middleware');
const controller         = require('./emailDocs.controller');

// ── OAuth routes — mounted at /auth in app.js ──────────────────────────────
const authRouter = Router();

// Specific callback paths registered before the parametric :provider route
// so Express matches them as literals first
authRouter.get('/email/google/callback',    controller.googleCallback);    // PUBLIC — no JWT
authRouter.get('/email/microsoft/callback', controller.microsoftCallback); // PUBLIC — no JWT

authRouter.get('/email/:provider/connect',     authenticateJWT, controller.connectEmail);
authRouter.get('/email/:provider/connect-url', authenticateJWT, controller.getConnectUrl);
authRouter.delete('/email/:provider/disconnect', authenticateJWT, controller.disconnect);

// ── Email docs routes — mounted at /email-docs in app.js ──────────────────
const emailDocsRouter = Router();

// Shim: parentAccess reads parentType/parentId from req.params — copy from body first.
const injectParent = (req, _res, next) => {
  req.params.parentType = req.body.parentType || 'trip';
  req.params.parentId   = req.body.parentId || req.body.tripId || req.query.tripId;
  next();
};

emailDocsRouter.get('/status',      authenticateJWT, controller.getStatus);
emailDocsRouter.get('/attachments', authenticateJWT, controller.listAttachments);
emailDocsRouter.post('/import',     authenticateJWT, injectParent, verifyParentAccess(), controller.importAttachments);

module.exports = { authRouter, emailDocsRouter };
