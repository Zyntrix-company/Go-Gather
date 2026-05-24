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
 * GET /users/:id/photos — Photos for a user's gallery, grouped by trip/event + activity.
 * Accepts optional ?parentType=trip|event&parentId=<uuid> to fetch all photos for a specific
 * trip/event (confirming the user is a member), used by the friend-gallery modal.
 */
const getUserPhotos = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.query;
    const photos = await usersService.getUserPhotos(
      req.params.id,
      parentType || null,
      parentId  || null,
    );
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

/**
 * PATCH /users/me/gallery-items/:parentType/:parentId/subtitle
 */
const upsertGallerySubtitle = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    if (!['trip', 'event'].includes(parentType)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'parentType must be trip or event' });
    }
    const { subtitle } = req.body;
    const result = await usersService.upsertGallerySubtitle(req.user.id, parentType, parentId, subtitle ?? null);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getArchivedUserGallery = async (req, res, next) => {
  try {
    const gallery = await usersService.getArchivedUserGallery(req.user.id);
    return res.status(200).json(gallery);
  } catch (error) {
    next(error);
  }
};

const archiveGalleryItem = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    if (!['trip', 'event'].includes(parentType)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'parentType must be trip or event' });
    }
    const result = await usersService.archiveGalleryItem(req.user.id, parentType, parentId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const unarchiveGalleryItem = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    if (!['trip', 'event'].includes(parentType)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'parentType must be trip or event' });
    }
    const result = await usersService.unarchiveGalleryItem(req.user.id, parentType, parentId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

/**
 * PATCH /users/device
 */
const updateDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken, platform } = req.body;
    await usersService.updateDeviceToken(req.user.id, { deviceToken, platform });
    return res.status(200).json({ message: 'Device token updated' });
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
  upsertGallerySubtitle,
  getArchivedUserGallery,
  archiveGalleryItem,
  unarchiveGalleryItem,
  updateDeviceToken,
};
