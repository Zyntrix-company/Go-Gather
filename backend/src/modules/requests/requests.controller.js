const requestsService = require('./requests.service');
const logger = require('../../utils/logger');

/** GET /requests — every pending request addressed to me (friend, trip, event). */
const getRequests = async (req, res, next) => {
  try {
    const result = await requestsService.getIncomingRequests(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/** PUT /requests/:type/:id — { action: 'approve' | 'decline' } */
const respondToRequest = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { action } = req.body;
    const result = await requestsService.respondToRequest(req.user.id, type, id, action);
    logger.info('Request responded', { userId: req.user.id, type, id, action });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { getRequests, respondToRequest };
