const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const authenticateJWT = require('../../middleware/authenticate');
const tripMemberMW = require('../../middleware/tripMember.middleware');
const tripAdminMW = require('../../middleware/tripAdmin.middleware');
const validate = require('../../middleware/validate');
const { docUpload, photoUpload, activityPhotoUpload, tripFilesUpload, handleMulterError } = require('../../middleware/upload.middleware');

const tripsController = require('./trips.controller');
const validators = require('./trips.validation');

// Submodule controllers
const activitiesCtrl = require('./submodules/activities/activities.controller');
const docsCtrl = require('./submodules/docs/docs.controller');
const membersCtrl = require('./submodules/members/members.controller');
const photosCtrl = require('./submodules/photos/photos.controller');
const expensesCtrl = require('./submodules/expenses/expenses.controller');
const pollsCtrl = require('./submodules/polls/polls.controller');
const notesCtrl = require('./submodules/notes/notes.controller');

const router = Router();

// Rate limiter for invite sending (max 20 per 15 min)
const inviteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'RATE_LIMIT', message: 'Too many invite requests, please try again later', statusCode: 429 },
});

// ─── Public invite routes (token-based, no tripMember check) ─────────────────
router.get('/invite/:token', validators.tokenParam, validate, tripsController.getInvite);
router.post('/invite/:token/accept', authenticateJWT, validators.tokenParam, validate, tripsController.acceptInvite);

// ─── All routes below require auth ───────────────────────────────────────────
router.use(authenticateJWT);

// Parse JSON-encoded string fields sent via multipart/form-data.
// Handles two common patterns from HTTP clients:
//   1. JSON string:        location='{"name":"Paris","lat":48.8}'
//   2. Bracket notation:   location[name]=Paris  location[lat]=48.8
const parseMultipartJsonFields = (req, _res, next) => {
  // Pattern 1 — JSON string fields
  const jsonFields = ['location', 'friendIds', 'emails'];
  for (const field of jsonFields) {
    if (req.body[field] && typeof req.body[field] === 'string') {
      try { req.body[field] = JSON.parse(req.body[field]); } catch (_) { /* leave as-is, validator will catch it */ }
    }
  }

  // Pattern 2 — bracket notation location (multer does not auto-nest these)
  if (!req.body.location && req.body['location[name]']) {
    req.body.location = {
      name: req.body['location[name]'] || null,
      lat:  req.body['location[lat]']  || null,
      lng:  req.body['location[lng]']  || null,
    };
  }
  next();
};

// ─── Trip CRUD ────────────────────────────────────────────────────────────────
router.post(
  '/',
  (req, res, next) => tripFilesUpload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'docs', maxCount: 10 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  parseMultipartJsonFields,
  validators.createTripValidation,
  validate,
  tripsController.createTrip,
);
router.get('/', validators.getTripsQuery, validate, tripsController.getTrips);
router.get('/:id', validators.tripIdParam, validate, tripMemberMW, tripsController.getTripById);
router.put('/:id', validators.updateTripValidation, validate, tripMemberMW, tripAdminMW, tripsController.updateTrip);
router.post('/:id/archive', validators.tripIdParam, validate, tripMemberMW, tripAdminMW, tripsController.archiveTrip);
router.post('/:id/unarchive', validators.tripIdParam, validate, tripMemberMW, tripAdminMW, tripsController.unarchiveTrip);
router.delete('/:id', validators.tripIdParam, validate, tripMemberMW, tripAdminMW, tripsController.deleteTrip);

// ─── Invites ──────────────────────────────────────────────────────────────────
router.post(
  '/:id/invite',
  inviteRateLimit,
  validators.inviteValidation,
  validate,
  tripMemberMW,
  tripsController.inviteMembers,
);

// ─── Activities ───────────────────────────────────────────────────────────────
router.get('/:id/activities', tripMemberMW, activitiesCtrl.getActivities);
router.post('/:id/activities', tripMemberMW, activitiesCtrl.createActivity);
router.put('/:id/activities/:actId', tripMemberMW, activitiesCtrl.updateActivity);
router.delete('/:id/activities/:actId', tripMemberMW, activitiesCtrl.deleteActivity);

// Activity photos
router.post(
  '/:id/activities/:actId/photos',
  tripMemberMW,
  (req, res, next) => activityPhotoUpload.array('photos', 5)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  activitiesCtrl.uploadActivityPhotos,
);
router.get('/:id/activities/:actId/photos', tripMemberMW, activitiesCtrl.getActivityPhotos);
router.delete('/:id/activities/:actId/photos/:photoId', tripMemberMW, activitiesCtrl.deleteActivityPhoto);

// ─── Docs ─────────────────────────────────────────────────────────────────────
router.get('/:id/docs', tripMemberMW, docsCtrl.getDocs);
router.post(
  '/:id/docs',
  tripMemberMW,
  (req, res, next) => docUpload.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  docsCtrl.uploadDoc,
);
router.delete('/:id/docs/:docId', tripMemberMW, docsCtrl.deleteDoc);

// ─── Members ──────────────────────────────────────────────────────────────────
router.get('/:id/members', tripMemberMW, membersCtrl.getMembers);
router.delete('/:id/members/:userId', tripMemberMW, tripAdminMW, membersCtrl.removeMember);

// ─── Photos ───────────────────────────────────────────────────────────────────
router.get('/:id/photos', tripMemberMW, photosCtrl.getPhotos);
router.post(
  '/:id/photos',
  tripMemberMW,
  (req, res, next) => photoUpload.array('photos', 5)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  photosCtrl.uploadPhotos,
);
router.delete('/:id/photos/:photoId', tripMemberMW, photosCtrl.deletePhoto);

// ─── Expenses ─────────────────────────────────────────────────────────────────
router.get('/:id/balances', tripMemberMW, expensesCtrl.getBalances);
router.post('/:id/settlements', tripMemberMW, expensesCtrl.settle);
router.get('/:id/expenses', tripMemberMW, expensesCtrl.getExpenses);
router.post('/:id/expenses', tripMemberMW, expensesCtrl.addExpense);
router.put('/:id/expenses/:eid', tripMemberMW, expensesCtrl.updateExpense);
router.delete('/:id/expenses/:eid', tripMemberMW, expensesCtrl.deleteExpense);

// ─── Polls ────────────────────────────────────────────────────────────────────
router.get('/:id/polls', tripMemberMW, pollsCtrl.getPolls);
router.post('/:id/polls', tripMemberMW, pollsCtrl.createPoll);
router.post('/:id/polls/:pollId/vote', tripMemberMW, pollsCtrl.vote);

// ─── Notes — multi-note schema ────────────────────────────────────────────────
router.get('/:id/notes', tripMemberMW, notesCtrl.getNotes);
router.post('/:id/notes', tripMemberMW, notesCtrl.createNote);
router.put('/:id/notes/:noteId', tripMemberMW, notesCtrl.updateNote);
router.delete('/:id/notes/:noteId', tripMemberMW, notesCtrl.deleteNote);
router.post('/:id/notes/:noteId/favorite', tripMemberMW, notesCtrl.favoriteNote);

module.exports = router;
