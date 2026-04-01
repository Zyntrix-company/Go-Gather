const { Router } = require('express');
const authenticateJWT = require('../../middleware/authenticate');
const tripMemberMW    = require('../../middleware/tripMember.middleware');
const controller      = require('./emailDocs.controller');

// ── OAuth routes — mounted at /auth in app.js ──────────────────────────────
const authRouter = Router();

// Specific callback paths registered before the parametric :provider route
// so Express matches them as literals first
authRouter.get('/email/google/callback',    controller.googleCallback);    // PUBLIC — no JWT
authRouter.get('/email/microsoft/callback', controller.microsoftCallback); // PUBLIC — no JWT

authRouter.get('/email/:provider/connect',      authenticateJWT, controller.connectEmail);
authRouter.delete('/email/:provider/disconnect', authenticateJWT, controller.disconnect);

// ── Email docs routes — mounted at /email-docs in app.js ──────────────────
const emailDocsRouter = Router();

// Shim: tripMemberMW reads req.params.id || req.params.tripId.
// For these routes tripId arrives in body or query, so copy it into params first.
const injectTripId = (req, _res, next) => {
  req.params.tripId = req.body.tripId || req.query.tripId;
  next();
};

emailDocsRouter.get('/status',      authenticateJWT, controller.getStatus);
emailDocsRouter.get('/attachments', authenticateJWT, controller.listAttachments);
emailDocsRouter.post('/import',     authenticateJWT, injectTripId, tripMemberMW, controller.importAttachments);

module.exports = { authRouter, emailDocsRouter };
