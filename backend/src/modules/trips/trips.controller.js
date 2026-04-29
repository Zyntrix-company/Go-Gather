const tripsService = require('./trips.service');
const sharedPhotosService = require('../shared/photos/photos.service');
const sharedDocsService = require('../shared/docs/docs.service');
const logger = require('../../utils/logger');

// ── POST /trips ───────────────────────────────────────────────
const createTrip = async (req, res, next) => {
  try {
    const trip = await tripsService.createTrip(req.user.id, req.body);

    // Upload any photos/videos attached at creation time → photos table
    const uploadedPhotos = [];
    const photoFiles = req.files?.photos;
    if (photoFiles?.length > 0) {
      logger.info('Uploading photos during trip creation', { tripId: trip.id, count: photoFiles.length });
      try {
        const photos = await sharedPhotosService.uploadPhotos(
          { parentType: 'trip', parentId: trip.id },
          req.user.id,
          photoFiles,
        );
        uploadedPhotos.push(...photos);
      } catch (err) {
        logger.error('Failed to upload photos during trip creation', {
          tripId: trip.id, error: err.message,
        });
      }
    } else if (!req.files) {
      // Request was sent as application/json — files can only be uploaded via multipart/form-data
      logger.warn('Trip created without files: request was not multipart/form-data', { tripId: trip.id });
    }

    // Upload any documents attached at creation time → docs table
    const uploadedDocs = [];
    const docFiles = req.files?.docs;
    if (docFiles?.length > 0) {
      logger.info('Uploading docs during trip creation', { tripId: trip.id, count: docFiles.length });
      for (const file of docFiles) {
        try {
          const doc = await sharedDocsService.uploadDoc(
            { parentType: 'trip', parentId: trip.id },
            req.user.id,
            file,
          );
          uploadedDocs.push(doc);
        } catch (err) {
          logger.warn('Failed to upload doc during trip creation', {
            tripId: trip.id, file: file.originalname, error: err.message,
          });
        }
      }
    }

    res.status(201).json({ trip, uploadedPhotos, uploadedDocs });
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
    await tripsService.deleteTrip(req.params.id, req.user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── POST /trips/:id/archive ───────────────────────────────────
const archiveTrip = async (req, res, next) => {
  try {
    const trip = await tripsService.archiveTrip(req.params.id);
    res.status(200).json({ trip });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── POST /trips/:id/unarchive ─────────────────────────────────
const unarchiveTrip = async (req, res, next) => {
  try {
    const trip = await tripsService.unarchiveTrip(req.params.id);
    res.status(200).json({ trip });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
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

// ── GET /trips/:id/reminders ──────────────────────────────────
const getTripReminders = async (req, res, next) => {
  try {
    const { query: db } = require('../../config/database');
    const result = await db(
      `SELECT id, reminder_type, scheduled_at, sent_at, created_at
       FROM trip_reminders
       WHERE trip_id = $1 AND sent_at IS NULL
       ORDER BY scheduled_at ASC`,
      [req.params.id],
    );
    res.status(200).json({ reminders: result.rows });
  } catch (error) {
    logger.error('GET /trips/:id/reminders', { tripId: req.params.id, error: error.message });
    next(error);
  }
};

module.exports = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  archiveTrip,
  unarchiveTrip,
  inviteMembers,
  getInvite,
  acceptInvite,
  getTripReminders,
};
