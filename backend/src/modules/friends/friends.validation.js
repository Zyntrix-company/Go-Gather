const { body, param, query } = require('express-validator');

const sendFriendRequestValidation = [
  body('toUserId')
    .isUUID()
    .withMessage('toUserId must be a valid UUID'),
];

const respondFriendRequestValidation = [
  param('connectionId')
    .isUUID()
    .withMessage('connectionId must be a valid UUID'),
  body('action')
    .isIn(['accept', 'decline'])
    .withMessage('action must be "accept" or "decline"'),
];

const removeFriendValidation = [
  param('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
];

const inviteFriendValidation = [
  body('channels')
    .isArray({ min: 1 })
    .withMessage('channels must be a non-empty array'),
  body('channels.*')
    .isIn(['email', 'sms', 'whatsapp', 'copy', 'share'])
    .withMessage('invalid channel'),
  body('emails')
    .optional()
    .isArray()
    .withMessage('emails must be an array'),
  body('emails.*')
    .optional()
    .isEmail()
    .withMessage('each email must be a valid email address'),
];

const searchFriendsValidation = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('search query too long'),
];

module.exports = {
  sendFriendRequestValidation,
  respondFriendRequestValidation,
  removeFriendValidation,
  inviteFriendValidation,
  searchFriendsValidation,
};
