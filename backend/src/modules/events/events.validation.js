const { body, param, query } = require('express-validator');

const isUUID = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ── Event CRUD ────────────────────────────────────────────────
const createEventValidation = [
  body('name').trim().notEmpty().withMessage('Event name is required').isLength({ min: 2, max: 255 }),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO 8601 date (YYYY-MM-DD)'),
  body('endDate')
    .isISO8601().withMessage('endDate must be a valid ISO 8601 date')
    .custom((val, { req }) => {
      if (new Date(val) < new Date(req.body.startDate)) {
        throw new Error('endDate must be on or after startDate');
      }
      return true;
    }),
  body('location').notEmpty().withMessage('location is required').isObject().withMessage('location must be an object'),
  body('location.name').notEmpty().withMessage('location.name is required').isString().isLength({ max: 500 }),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('location.lat must be a valid latitude'),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('location.lng must be a valid longitude'),
  body('reminders').optional().isBoolean(),
  body('friendIds').optional().isArray(),
  body('friendIds.*').optional().custom((val) => {
    if (!isUUID(val)) throw new Error('Each friendId must be a valid UUID');
    return true;
  }),
  body('emails').optional().isArray(),
  body('emails.*').optional().isEmail().withMessage('Each email must be valid'),
];

const updateEventValidation = [
  param('eventId').isUUID().withMessage('Event ID must be a valid UUID'),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('location').optional().isObject(),
  body('location.name').optional().isString().isLength({ max: 500 }),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),
];

const eventIdParam = [
  param('eventId').isUUID().withMessage('Event ID must be a valid UUID'),
];

const getEventsQuery = [
  query('status')
    .optional()
    .isIn(['upcoming', 'past', 'ongoing'])
    .withMessage('status must be upcoming, past, or ongoing'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// ── Invites ───────────────────────────────────────────────────
const inviteValidation = [
  param('eventId').isUUID().withMessage('Event ID must be a valid UUID'),
  body('friendIds').optional().isArray(),
  body('friendIds.*').optional().custom((val) => {
    if (!isUUID(val)) throw new Error('Each friendId must be a valid UUID');
    return true;
  }),
  body('emails').optional().isArray(),
  body('emails.*').optional().isEmail().withMessage('Each email must be valid'),
];

const tokenParam = [
  param('token').notEmpty().withMessage('Invite token is required'),
];

module.exports = {
  createEventValidation,
  updateEventValidation,
  eventIdParam,
  getEventsQuery,
  inviteValidation,
  tokenParam,
};
