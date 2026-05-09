const usersService = require('./service');
const logger = require('../../utils/logger');

/**
 * POST /users/profile
 */
const saveProfile = async (req, res, next) => {
  try {
    const result = await usersService.saveProfile(req.user.id, req.body);

    logger.info('Profile saved', { userId: req.user.id });

    return res.status(200).json({
      message: 'Profile saved successfully',
      user: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /users/photo
 */
const uploadPhoto = async (req, res, next) => {
  try {
    const result = await usersService.uploadPhoto(req.user.id, req.file);

    return res.status(200).json({
      message: 'Profile photo uploaded successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:id
 */
const getPublicProfile = async (req, res, next) => {
  try {
    const user = await usersService.getPublicProfile(req.params.id);

    return res.status(200).json({
      message: 'User profile fetched',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /users/profile — Update profile fields (including username)
 */
const updateProfile = async (req, res, next) => {
  try {
    const result = await usersService.updateProfile(req.user.id, req.body);
    return res.status(200).json({ message: 'Profile updated successfully', user: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/search — Search users with friendship status
 */
const searchUsers = async (req, res, next) => {
  try {
    const users = await usersService.searchUsers(req.user.id, req.query.q);
    return res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:id/profile — Enhanced profile with friendship + stats
 */
const getUserProfile = async (req, res, next) => {
  try {
    const profile = await usersService.getUserProfile(req.user.id, req.params.id);
    return res.status(200).json({ user: profile });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:id/gallery — Past trips and events
 */
const getUserGallery = async (req, res, next) => {
  try {
    const gallery = await usersService.getUserGallery(req.params.id);
    return res.status(200).json(gallery);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:id/photos — All photos uploaded by a user, grouped by trip/event + activity
 */
const getUserPhotos = async (req, res, next) => {
  try {
    const photos = await usersService.getUserPhotos(req.params.id);
    return res.status(200).json(photos);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/notification-settings
 */
const getNotificationSettings = async (req, res, next) => {
  try {
    const result = await usersService.getNotificationSettings(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /users/notification-settings
 */
const updateNotificationSettings = async (req, res, next) => {
  try {
    const result = await usersService.updateNotificationSettings(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/legal-status
 */
const getLegalStatus = async (req, res, next) => {
  try {
    const status = await usersService.getLegalStatus(req.user.id);
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users/legal-ack
 */
const acknowledgeLegal = async (req, res, next) => {
  try {
    const status = await usersService.acknowledgeLegal(req.user.id, req.body);
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveProfile,
  uploadPhoto,
  getPublicProfile,
  updateProfile,
  searchUsers,
  getUserProfile,
  getUserGallery,
  getUserPhotos,
  getNotificationSettings,
  updateNotificationSettings,
  getLegalStatus,
  acknowledgeLegal,
};
