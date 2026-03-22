const invitesService = require('./invites.service');
const logger = require('../../utils/logger');

/**
 * GET /invites/validate/:token — public, no JWT
 */
const validateInvite = async (req, res, next) => {
  try {
    const result = await invitesService.validateInvite(req.params.token);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /invites/claim/:token — requires JWT
 */
const claimInvite = async (req, res, next) => {
  try {
    const result = await invitesService.claimInvite(req.params.token, req.user.id);
    logger.info('Invite claimed', { token: req.params.token, userId: req.user.id });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { validateInvite, claimInvite };
