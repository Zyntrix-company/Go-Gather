const homeService = require('./home.service');
const logger = require('../../utils/logger');

const getDashboard = async (req, res, next) => {
  try {
    const data = await homeService.getHomeDashboard(req.user.id);
    res.status(200).json(data);
  } catch (error) {
    logger.error('GET /home failed', { userId: req.user.id, error: error.message });
    next(error);
  }
};

module.exports = { getDashboard };
