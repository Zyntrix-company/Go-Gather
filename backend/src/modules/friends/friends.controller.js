const friendsService = require('./friends.service');
const logger = require('../../utils/logger');

/**
 * POST /friends/request
 */
const sendFriendRequest = async (req, res, next) => {
  try {
    const result = await friendsService.sendFriendRequest(req.user.id, req.body.toUserId);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /friends/request/:connectionId
 */
const respondFriendRequest = async (req, res, next) => {
  try {
    const result = await friendsService.respondFriendRequest(
      req.user.id,
      req.params.connectionId,
      req.body.action,
    );
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /friends/requests
 */
const getFriendRequests = async (req, res, next) => {
  try {
    const result = await friendsService.getFriendRequests(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /friends
 */
const getFriends = async (req, res, next) => {
  try {
    const result = await friendsService.getFriends(req.user.id, req.query.search);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /friends/:userId
 */
const removeFriend = async (req, res, next) => {
  try {
    const result = await friendsService.removeFriend(req.user.id, req.params.userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /friends/invite
 */
const inviteFriend = async (req, res, next) => {
  try {
    const result = await friendsService.createFriendInvite(req.user.id, req.body);
    logger.info('Friend invite created', { userId: req.user.id, token: result.token });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendFriendRequest,
  respondFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  inviteFriend,
};
