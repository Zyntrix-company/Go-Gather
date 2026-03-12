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

module.exports = {
  saveProfile,
  uploadPhoto,
  getPublicProfile,
};
