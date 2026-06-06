const { Router }        = require('express');
const authenticateJWT   = require('../../middleware/authenticate');
const verifyParentAccess = require('../../middleware/parentAccess.middleware');
const controller        = require('./driveDocs.controller');

// ── OAuth routes — mounted at /auth in app.js ─────────────────────────────
const authRouter = Router();

authRouter.get('/drive/callback',      controller.driveCallback);                     // PUBLIC — no JWT
authRouter.get('/drive/connect-url',   authenticateJWT, controller.getConnectUrl);
authRouter.delete('/drive/disconnect', authenticateJWT, controller.disconnect);

// ── Drive docs routes — mounted at /drive-docs in app.js ─────────────────
const driveDocsRouter = Router();

const injectParent = (req, _res, next) => {
  req.params.parentType = req.body.parentType || 'trip';
  req.params.parentId   = req.body.parentId || req.body.tripId || req.query.tripId;
  next();
};

driveDocsRouter.get('/status',  authenticateJWT, controller.getStatus);
driveDocsRouter.get('/files',   authenticateJWT, controller.listFiles);
driveDocsRouter.post('/import', authenticateJWT, injectParent, verifyParentAccess(), controller.importFiles);
driveDocsRouter.post('/import-photos', authenticateJWT, injectParent, verifyParentAccess(), controller.importPhotos);

module.exports = { authRouter: authRouter, driveDocsRouter };
