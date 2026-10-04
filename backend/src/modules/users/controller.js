const usersService = require('./service');
const galleryAlbumsService = require('./galleryAlbums.service');
const galleryOverlayService = require('./galleryOverlay.service');
const galleryEngagementService = require('./galleryEngagement.service');
const sharedPhotosService = require('../shared/photos/photos.service');
const tripMembersService = require('../trips/submodules/members/members.service');
const eventsService = require('../events/events.service');
const accountDeletionService = require('./accountDeletion.service');
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
    const { subtitle, hideTravelers } = req.body;
    const patch = {};
    if (subtitle !== undefined) patch.subtitle = subtitle ?? null;
    if (hideTravelers !== undefined) patch.hideTravelers = hideTravelers;
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Provide subtitle and/or hideTravelers' });
    }
    if (parentType !== 'trip' && hideTravelers !== undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'hideTravelers applies to trip albums only' });
    }
    const result = await usersService.upsertGalleryItemMeta(req.user.id, parentType, parentId, patch);
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

const createGalleryAlbum = async (req, res, next) => {
  try {
    const album = await galleryAlbumsService.createAlbum(req.user.id, req.body);
    return res.status(201).json({ album });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const updateGalleryAlbum = async (req, res, next) => {
  try {
    const album = await galleryAlbumsService.updateAlbum(req.user.id, req.params.albumId, req.body);
    return res.status(200).json({ album });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const archiveGalleryAlbum = async (req, res, next) => {
  try {
    const result = await galleryAlbumsService.archiveAlbum(req.user.id, req.params.albumId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const unarchiveGalleryAlbum = async (req, res, next) => {
  try {
    const result = await galleryAlbumsService.unarchiveAlbum(req.user.id, req.params.albumId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const deleteGalleryAlbum = async (req, res, next) => {
  try {
    const result = await galleryAlbumsService.deleteAlbum(req.user.id, req.params.albumId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getMyGalleryAlbumPhotos = async (req, res, next) => {
  try {
    await galleryAlbumsService.assertAlbumOwner(req.params.albumId, req.user.id);
    const result = await galleryAlbumsService.getAlbumPhotos(req.params.albumId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getUserGalleryAlbumPhotos = async (req, res, next) => {
  try {
    const result = await galleryAlbumsService.getAlbumPhotosForProfile(req.params.id, req.params.albumId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const uploadGalleryAlbumPhotos = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one photo is required' });
    }
    const result = await galleryAlbumsService.uploadAlbumPhotos(req.user.id, req.params.albumId, req.files);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const deleteGalleryAlbumPhoto = async (req, res, next) => {
  try {
    await galleryAlbumsService.deleteAlbumPhoto(req.user.id, req.params.albumId, req.params.photoId);
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getMyGalleryItemPhotos = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    const result = await galleryOverlayService.getSharedAlbumPhotos(
      req.user.id,
      parentType,
      parentId,
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getUserGalleryItemPhotos = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    const result = await galleryOverlayService.getSharedAlbumPhotos(
      req.params.id,
      parentType,
      parentId,
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getUserGalleryItemMembers = async (req, res, next) => {
  try {
    const { id: targetUserId, parentType, parentId } = req.params;
    await galleryOverlayService.verifyMembership(targetUserId, parentType, parentId);
    await galleryOverlayService.verifyViewerAccess(req.user.id, targetUserId);
    const result = parentType === 'trip'
      ? await tripMembersService.getMembers(parentId)
      : await eventsService.getEventMembers(parentId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const uploadGalleryItemPhotos = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one photo is required' });
    }
    const { parentType, parentId } = req.params;
    await galleryOverlayService.verifyMembership(req.user.id, parentType, parentId);
    const photos = await sharedPhotosService.uploadPhotos(
      { parentType, parentId },
      req.user.id,
      req.files,
    );
    return res.status(201).json({ photos });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getGalleryEngagement = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    const galleryOwnerId = req.query.galleryOwnerId || undefined;
    const result = await galleryEngagementService.getEngagement(
      req.user.id,
      parentType,
      parentId,
      { galleryOwnerId },
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const toggleGalleryLike = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    const galleryOwnerId = req.query.galleryOwnerId || undefined;
    const opts = { galleryOwnerId };
    const result = await galleryEngagementService.toggleLike(
      req.user.id,
      parentType,
      parentId,
      opts,
    );
    const engagement = await galleryEngagementService.getEngagement(
      req.user.id,
      parentType,
      parentId,
      opts,
    );
    return res.status(200).json({ ...result, likeCount: engagement.likeCount });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const addGalleryComment = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.params;
    const galleryOwnerId = req.query.galleryOwnerId || undefined;
    const comment = await galleryEngagementService.addComment(
      req.user.id,
      parentType,
      parentId,
      req.body.text,
      { galleryOwnerId },
    );
    return res.status(201).json({ comment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const updateGalleryComment = async (req, res, next) => {
  try {
    const comment = await galleryEngagementService.updateComment(
      req.user.id,
      req.params.commentId,
      req.body.text,
    );
    return res.status(200).json({ comment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const deleteGalleryComment = async (req, res, next) => {
  try {
    const result = await galleryEngagementService.deleteComment(req.user.id, req.params.commentId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const getCustomAlbumEngagement = async (req, res, next) => {
  try {
    const result = await galleryEngagementService.getEngagement(
      req.user.id,
      galleryEngagementService.PARENT_TYPE_GALLERY_ALBUM,
      req.params.albumId,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const toggleCustomAlbumLike = async (req, res, next) => {
  try {
    const parentType = galleryEngagementService.PARENT_TYPE_GALLERY_ALBUM;
    const { albumId } = req.params;
    const result = await galleryEngagementService.toggleLike(req.user.id, parentType, albumId);
    const engagement = await galleryEngagementService.getEngagement(req.user.id, parentType, albumId);
    return res.status(200).json({ ...result, likeCount: engagement.likeCount });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.error, message: error.message });
    next(error);
  }
};

const addCustomAlbumComment = async (req, res, next) => {
  try {
    const comment = await galleryEngagementService.addComment(
      req.user.id,
      galleryEngagementService.PARENT_TYPE_GALLERY_ALBUM,
      req.params.albumId,
      req.body.text,
    );
    return res.status(201).json({ comment });
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

/**
 * DELETE /users/me — permanently delete the caller's account
 */
const deleteAccount = async (req, res, next) => {
  try {
    await accountDeletionService.deleteUserAccount(req.user.id);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  deleteAccount,
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
  createGalleryAlbum,
  updateGalleryAlbum,
  archiveGalleryAlbum,
  unarchiveGalleryAlbum,
  deleteGalleryAlbum,
  getMyGalleryAlbumPhotos,
  getUserGalleryAlbumPhotos,
  uploadGalleryAlbumPhotos,
  deleteGalleryAlbumPhoto,
  getMyGalleryItemPhotos,
  getUserGalleryItemPhotos,
  getUserGalleryItemMembers,
  uploadGalleryItemPhotos,
  getGalleryEngagement,
  toggleGalleryLike,
  addGalleryComment,
  updateGalleryComment,
  deleteGalleryComment,
  getCustomAlbumEngagement,
  toggleCustomAlbumLike,
  addCustomAlbumComment,
  updateDeviceToken,
};
