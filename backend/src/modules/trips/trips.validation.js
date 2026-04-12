const { body, param, query } = require('express-validator');

// ── Helpers ───────────────────────────────────────────────────
const isUUID = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ── Trip CRUD ─────────────────────────────────────────────────
const createTripValidation = [
  body('name').trim().notEmpty().withMessage('Trip name is required').isLength({ min: 3, max: 255 }),
  body('startDate')
    .isISO8601().withMessage('startDate must be a valid ISO 8601 date (YYYY-MM-DD)')
    .custom((val) => {
      const start = new Date(val);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      if (start > maxDate) {
        throw new Error('startDate cannot be more than 1 year from today');
      }
      return true;
    }),
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
  body('location.lat')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('location.lat must be a valid latitude'),
  body('location.lng')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('location.lng must be a valid longitude'),
  body('bannerImageUrl').optional({ nullable: true }).isURL().withMessage('bannerImageUrl must be a valid URL'),
  body('reminders').optional().isBoolean(),
  body('friendIds').optional().isArray(),
  body('friendIds.*')
    .optional()
    .custom((val) => {
      if (!isUUID(val)) throw new Error('Each friendId must be a valid UUID');
      return true;
    }),
  body('emails').optional().isArray(),
  body('emails.*').optional().isEmail().withMessage('Each email must be valid'),
];

const updateTripValidation = [
  param('id').isUUID().withMessage('Trip ID must be a valid UUID'),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('startDate').optional().isISO8601().custom((val) => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    if (new Date(val) > maxDate) throw new Error('startDate cannot be more than 1 year from today');
    return true;
  }),
  body('endDate').optional().isISO8601().custom((val) => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    if (new Date(val) > maxDate) throw new Error('endDate cannot be more than 1 year from today');
    return true;
  }),
  body('location').optional().isObject(),
  body('location.name').optional().isString().isLength({ max: 500 }),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  body('bannerImageUrl').optional({ nullable: true }).isURL().withMessage('bannerImageUrl must be a valid URL'),
];

const tripIdParam = [
  param('id').isUUID().withMessage('Trip ID must be a valid UUID'),
];

const getTripsQuery = [
  query('status')
    .optional()
    .isIn(['upcoming', 'past', 'ongoing', 'archived'])
    .withMessage('status must be upcoming, past, ongoing, or archived'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// ── Invites ───────────────────────────────────────────────────
const inviteValidation = [
  param('id').isUUID().withMessage('Trip ID must be a valid UUID'),
  body('friendIds').optional().isArray(),
  body('friendIds.*')
    .optional()
    .custom((val) => {
      if (!isUUID(val)) throw new Error('Each friendId must be a valid UUID');
      return true;
    }),
  body('emails').optional().isArray(),
  body('emails.*').optional().isEmail().withMessage('Each email must be valid'),
  body('phones').optional().isArray(),
  body('phones.*').optional().isString().withMessage('Each phone must be a string'),
];

const tokenParam = [
  param('token').notEmpty().withMessage('Invite token is required'),
];

module.exports = {
  createTripValidation,
  updateTripValidation,
  tripIdParam,
  getTripsQuery,
  inviteValidation,
  tokenParam,
};
