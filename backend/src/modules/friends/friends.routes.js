const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./friends.controller');
const {
  sendFriendRequestValidation,
  respondFriendRequestValidation,
  removeFriendValidation,
  inviteFriendValidation,
  searchFriendsValidation,
} = require('./friends.validation');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// All friends routes require authentication
router.use(authenticateJWT);

// ── Rate limiters ──────────────────────────────────────────────────────────────

const inviteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: parseInt(process.env.FRIEND_INVITE_RATE_LIMIT_PER_HOUR, 10) || 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
});

const requestRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: parseInt(process.env.FRIEND_REQUEST_RATE_LIMIT_PER_DAY, 10) || 20,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /friends — friends list (with optional search)
router.get(
  '/',
  searchFriendsValidation,
  validate,
  controller.getFriends,
);

// GET /friends/requests — incoming + outgoing pending requests
router.get('/requests', controller.getFriendRequests);

// POST /friends/request — send a direct request to an existing user
router.post(
  '/request',
  requestRateLimit,
  sendFriendRequestValidation,
  validate,
  controller.sendFriendRequest,
);

// PUT /friends/request/:connectionId — accept or decline
router.put(
  '/request/:connectionId',
  respondFriendRequestValidation,
  validate,
  controller.respondFriendRequest,
);

// POST /friends/invite — generate Branch smart link for non-GatherGo user
router.post(
  '/invite',
  inviteRateLimit,
  inviteFriendValidation,
  validate,
  controller.inviteFriend,
);

// DELETE /friends/:userId — remove friendship (hard delete)
router.delete(
  '/:userId',
  removeFriendValidation,
  validate,
  controller.removeFriend,
);

module.exports = router;
