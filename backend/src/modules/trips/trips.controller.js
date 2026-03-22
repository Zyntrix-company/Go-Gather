const tripsService = require('./trips.service');
const logger = require('../../utils/logger');

// ── POST /trips ───────────────────────────────────────────────
const createTrip = async (req, res, next) => {
  try {
    const trip = await tripsService.createTrip(req.user.id, req.body);
    res.status(201).json({ trip });
  } catch (error) {
    logger.error('POST /trips', { userId: req.user.id, error: error.message });
    next(error);
  }
};

// ── GET /trips ────────────────────────────────────────────────
const getTrips = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await tripsService.getTrips(req.user.id, {
      status, page: parseInt(page), limit: parseInt(limit),
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ── GET /trips/:id ────────────────────────────────────────────
const getTripById = async (req, res, next) => {
  try {
    const data = await tripsService.getTripById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', statusCode: 404 });
    }
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// ── PUT /trips/:id ────────────────────────────────────────────
const updateTrip = async (req, res, next) => {
  try {
    const trip = await tripsService.updateTrip(req.params.id, req.body);
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /trips/:id ─────────────────────────────────────────
const deleteTrip = async (req, res, next) => {
  try {
    await tripsService.deleteTrip(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── POST /trips/:id/invite ────────────────────────────────────
const inviteMembers = async (req, res, next) => {
  try {
    const result = await tripsService.inviteToTrip(req.params.id, req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ── GET /trips/invite/:token ──────────────────────────────────
const getInvite = async (req, res, next) => {
  try {
    const invite = await tripsService.getInviteByToken(req.params.token);
    if (!invite) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invite not found', statusCode: 404 });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'TOKEN_EXPIRED', message: 'Invite token has expired', statusCode: 410 });
    }
    if (invite.accepted_at) {
      return res.status(409).json({ error: 'CONFLICT', message: 'Invite already accepted', statusCode: 409 });
    }
    res.status(200).json({
      tripId: invite.trip_id,
      tripName: invite.trip_name,
      inviterName: invite.inviter_name,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /trips/invite/:token/accept ─────────────────────────
const acceptInvite = async (req, res, next) => {
  try {
    const result = await tripsService.acceptInvite(req.params.token, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

module.exports = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  inviteMembers,
  getInvite,
  acceptInvite,
};
