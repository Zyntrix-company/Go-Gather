const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const authenticateJWT = require('../../middleware/authenticate');
const eventMemberMW = require('../../middleware/eventMember.middleware');
const eventAdminMW = require('../../middleware/eventAdmin.middleware');
const validate = require('../../middleware/validate');
const { docUpload, photoUpload, handleMulterError } = require('../../middleware/upload.middleware');
const { limits } = require('../../config/uploadLimits');

const ctrl = require('./events.controller');
const validators = require('./events.validation');

const router = Router();

// Rate limiter for invite sending (max 20 per 15 min)
const inviteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'RATE_LIMIT', message: 'Too many invite requests, please try again later', statusCode: 429 },
});

// ─── Public invite routes (token-based, no eventMember check) ─────────────────
router.get('/invite/:token', validators.tokenParam, validate, ctrl.getInvite);
router.post('/invite/:token/accept', authenticateJWT, validators.tokenParam, validate, ctrl.acceptInvite);

// ─── All routes below require auth ───────────────────────────────────────────
router.use(authenticateJWT);

// ─── Event CRUD ───────────────────────────────────────────────────────────────
router.post(
  '/',
  validators.createEventValidation,
  validate,
  ctrl.createEvent,
);
router.get('/', validators.getEventsQuery, validate, ctrl.getEvents);
router.get('/:eventId', validators.eventIdParam, validate, eventMemberMW, ctrl.getEventById);
router.put('/:eventId', validators.updateEventValidation, validate, eventMemberMW, eventAdminMW, ctrl.updateEvent);
router.delete('/:eventId', validators.eventIdParam, validate, eventMemberMW, eventAdminMW, ctrl.deleteEvent);

// ─── Description ──────────────────────────────────────────────────────────────
router.post('/:eventId/description', validators.descriptionValidation, validate, eventMemberMW, eventAdminMW, ctrl.setDescription);
router.put('/:eventId/description', validators.descriptionValidation, validate, eventMemberMW, eventAdminMW, ctrl.updateDescription);

// ─── Archive ──────────────────────────────────────────────────────────────────
router.post('/:eventId/archive', validators.eventIdParam, validate, eventMemberMW, eventAdminMW, ctrl.archiveEvent);
router.post('/:eventId/unarchive', validators.eventIdParam, validate, eventMemberMW, eventAdminMW, ctrl.unarchiveEvent);

// ─── Invites ──────────────────────────────────────────────────────────────────
router.post(
  '/:eventId/invite',
  inviteRateLimit,
  validators.inviteValidation,
  validate,
  eventMemberMW,
  ctrl.inviteMembers,
);

// ─── Members ──────────────────────────────────────────────────────────────────
router.get('/:eventId/members', eventMemberMW, ctrl.getMembers);
router.delete('/:eventId/members/:userId', eventMemberMW, eventAdminMW, ctrl.removeMember);

// ─── Docs ─────────────────────────────────────────────────────────────────────
router.get('/:eventId/docs', eventMemberMW, ctrl.getDocs);
router.post(
  '/:eventId/docs',
  eventMemberMW,
  (req, res, next) => docUpload.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  ctrl.uploadDoc,
);
router.delete('/:eventId/docs/:docId', eventMemberMW, ctrl.deleteDoc);

// ─── Photos ───────────────────────────────────────────────────────────────────
router.get('/:eventId/photos', eventMemberMW, ctrl.getPhotos);
router.post(
  '/:eventId/photos',
  eventMemberMW,
  (req, res, next) => photoUpload.array('photos', limits.eventPhoto.maxBatchFiles)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  }),
  ctrl.uploadPhotos,
);
router.delete('/:eventId/photos/:photoId', eventMemberMW, ctrl.deletePhoto);

// ─── Expenses ─────────────────────────────────────────────────────────────────
router.get('/:eventId/balances', eventMemberMW, ctrl.getBalances);
router.post('/:eventId/settlements', eventMemberMW, ctrl.settle);
router.get('/:eventId/expenses', eventMemberMW, ctrl.getExpenses);
router.post('/:eventId/expenses', eventMemberMW, ctrl.addExpense);
router.put('/:eventId/expenses/:expenseId', eventMemberMW, ctrl.updateExpense);
router.delete('/:eventId/expenses/:expenseId', eventMemberMW, ctrl.deleteExpense);

// ─── Polls ────────────────────────────────────────────────────────────────────
router.get('/:eventId/polls', eventMemberMW, ctrl.getPolls);
router.post('/:eventId/polls', eventMemberMW, ctrl.createPoll);
router.post('/:eventId/polls/:pollId/vote', eventMemberMW, ctrl.vote);
router.delete('/:eventId/polls/:pollId', eventMemberMW, ctrl.deletePoll);

// ─── Reminders ────────────────────────────────────────────────────────────────
router.get('/:eventId/reminders', eventMemberMW, ctrl.getEventReminders);

// ─── Section views (badge tracking) ──────────────────────────────────────────
router.post('/:eventId/sections/:section/view', eventMemberMW, ctrl.markSectionViewed);

// ─── Notes ────────────────────────────────────────────────────────────────────
router.get('/:eventId/notes', eventMemberMW, ctrl.getNotes);
router.post('/:eventId/notes', eventMemberMW, ctrl.createNote);
router.put('/:eventId/notes/:noteId', eventMemberMW, ctrl.updateNote);
router.delete('/:eventId/notes/:noteId', eventMemberMW, ctrl.deleteNote);

// ─── NO ACTIVITIES ROUTE ──────────────────────────────────────────────────────
// Events deliberately do not have activities. /events/:eventId/activities is not registered.

module.exports = router;
