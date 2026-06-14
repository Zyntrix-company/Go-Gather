const eventsService = require('./events.service');
const sharedDocsService = require('../shared/docs/docs.service');
const sharedPhotosService = require('../shared/photos/photos.service');
const sharedExpensesService = require('../shared/expenses/expenses.service');
const sharedPollsService = require('../shared/polls/polls.service');
const sharedNotesService = require('../shared/notes/notes.service');
const logger = require('../../utils/logger');

const VALID_NOTE_CATEGORIES = ['general', 'idea', 'important', 'todo'];

// ── POST /events ──────────────────────────────────────────────
const createEvent = async (req, res, next) => {
  try {
    const event = await eventsService.createEvent(req.user.id, req.body);
    res.status(201).json({ event });
  } catch (error) {
    logger.error('POST /events', { userId: req.user.id, error: error.message });
    next(error);
  }
};

// ── GET /events ───────────────────────────────────────────────
const getEvents = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await eventsService.getEvents(req.user.id, {
      status, page: parseInt(page), limit: parseInt(limit),
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ── GET /events/:eventId ──────────────────────────────────────
const getEventById = async (req, res, next) => {
  try {
    const data = await eventsService.getEventById(req.params.eventId, req.user.id);
    if (!data) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Event not found', statusCode: 404 });
    }
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// ── PUT /events/:eventId ──────────────────────────────────────
const updateEvent = async (req, res, next) => {
  try {
    const event = await eventsService.updateEvent(req.params.eventId, req.body);
    res.status(200).json({ event });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /events/:eventId ───────────────────────────────────
const deleteEvent = async (req, res, next) => {
  try {
    await eventsService.deleteEvent(req.params.eventId);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── POST /events/:eventId/description ────────────────────────
const setDescription = async (req, res, next) => {
  try {
    const event = await eventsService.setEventDescription(req.params.eventId, req.body.description ?? null);
    res.status(200).json({ event });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── PUT /events/:eventId/description ─────────────────────────
const updateDescription = async (req, res, next) => {
  try {
    const event = await eventsService.setEventDescription(req.params.eventId, req.body.description ?? null);
    res.status(200).json({ event });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── POST /events/:eventId/archive ─────────────────────────────
const archiveEvent = async (req, res, next) => {
  try {
    const event = await eventsService.archiveEvent(req.params.eventId);
    res.status(200).json({ event });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── POST /events/:eventId/unarchive ───────────────────────────
const unarchiveEvent = async (req, res, next) => {
  try {
    const event = await eventsService.unarchiveEvent(req.params.eventId);
    res.status(200).json({ event });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── POST /events/:eventId/invite ──────────────────────────────
const inviteMembers = async (req, res, next) => {
  try {
    const result = await eventsService.inviteToEvent(req.params.eventId, req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── GET /events/invite/:token ─────────────────────────────────
const getInvite = async (req, res, next) => {
  try {
    const invite = await eventsService.getEventInviteByToken(req.params.token);
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
      eventId: invite.event_id,
      eventName: invite.event_name,
      inviterName: invite.inviter_name,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /events/invite/:token/accept ─────────────────────────
const acceptInvite = async (req, res, next) => {
  try {
    const result = await eventsService.acceptEventInvite(req.params.token, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ── GET /events/:eventId/members ──────────────────────────────
const getMembers = async (req, res, next) => {
  try {
    const result = await eventsService.getEventMembers(req.params.eventId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ── DELETE /events/:eventId/members/:userId ───────────────────
const removeMember = async (req, res, next) => {
  try {
    await eventsService.removeEventMember(req.params.eventId, req.params.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.error, message: error.message, statusCode: error.statusCode });
    }
    next(error);
  }
};

// ─── DOCS ─────────────────────────────────────────────────────────────────────

const uploadDoc = async (req, res, next) => {
  try {
    const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one file is required', statusCode: 400 });
    }
    const result = await sharedDocsService.uploadDocs(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      files,
    );
    res.status(201).json({
      doc: result.docs[0] ?? null,
      docs: result.docs,
      total: result.total,
    });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getDocs = async (req, res, next) => {
  try {
    const result = await sharedDocsService.getDocs({ parentType: 'event', parentId: req.params.eventId });
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const deleteDoc = async (req, res, next) => {
  try {
    await sharedDocsService.deleteDoc({
      docId: req.params.docId,
      parentType: 'event',
      parentId: req.params.eventId,
      requesterId: req.user.id,
      requesterRole: req.eventMember.role,
    });
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

// ─── PHOTOS ───────────────────────────────────────────────────────────────────

const uploadPhotos = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'At least one photo is required', statusCode: 400 });
    }
    const photos = await sharedPhotosService.uploadPhotos(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      req.files,
    );
    res.status(201).json({ photos });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getPhotos = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const result = await sharedPhotosService.getPhotos(
      { parentType: 'event', parentId: req.params.eventId },
      { page: parseInt(page), limit: parseInt(limit) },
    );
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const deletePhoto = async (req, res, next) => {
  try {
    await sharedPhotosService.deletePhoto({
      photoId: req.params.photoId,
      parentType: 'event',
      parentId: req.params.eventId,
      requesterId: req.user.id,
      requesterRole: req.eventMember.role,
    });
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

const addExpense = async (req, res, next) => {
  try {
    const result = await sharedExpensesService.addExpense(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      req.body,
    );
    res.status(201).json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const result = await sharedExpensesService.getExpenses(
      { parentType: 'event', parentId: req.params.eventId },
      { category, page: parseInt(page), limit: parseInt(limit) },
    );
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const updateExpense = async (req, res, next) => {
  try {
    const result = await sharedExpensesService.updateExpense(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.expenseId,
      req.user.id,
      req.eventMember.role,
      req.body,
    );
    res.status(200).json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const balances = await sharedExpensesService.deleteExpense(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.expenseId,
      req.user.id,
      req.eventMember.role,
    );
    res.status(200).json({ success: true, balances });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getBalances = async (req, res, next) => {
  try {
    const balances = await sharedExpensesService.getBalances(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
    );
    res.status(200).json(balances);
  } catch (e) { next(e); }
};

const settle = async (req, res, next) => {
  try {
    const { withUserId, amount, currency } = req.body;
    if (!withUserId || !amount) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'withUserId and amount are required', statusCode: 400 });
    }
    const outstanding = await sharedExpensesService.settle(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      { withUserId, amount, currency },
    );
    res.status(200).json({ outstanding });
  } catch (e) { next(e); }
};

// ─── POLLS ────────────────────────────────────────────────────────────────────

const createPoll = async (req, res, next) => {
  try {
    const poll = await sharedPollsService.createPoll(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      req.body,
    );
    res.status(201).json({ poll });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getPolls = async (req, res, next) => {
  try {
    const polls = await sharedPollsService.getPolls(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
    );
    res.status(200).json({ polls });
  } catch (e) { next(e); }
};

const vote = async (req, res, next) => {
  try {
    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'optionId is required', statusCode: 400 });
    }
    const poll = await sharedPollsService.vote(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.pollId,
      req.user.id,
      optionId,
    );
    res.status(200).json({ poll });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deletePoll = async (req, res, next) => {
  try {
    await sharedPollsService.deletePoll(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.pollId,
      req.user.id,
    );
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

// ─── NOTES ────────────────────────────────────────────────────────────────────

const getNotes = async (req, res, next) => {
  try {
    const result = await sharedNotesService.getNotes(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
    );
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const createNote = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title is required', statusCode: 400 });
    }
    if (String(title).length > 255) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title must be at most 255 characters', statusCode: 400 });
    }
    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'content is required', statusCode: 400 });
    }
    if (String(content).length > 5000) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'content must be at most 5000 characters', statusCode: 400 });
    }
    if (category && !VALID_NOTE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `category must be one of: ${VALID_NOTE_CATEGORIES.join(', ')}`,
        statusCode: 400,
      });
    }

    const note = await sharedNotesService.createNote(
      { parentType: 'event', parentId: req.params.eventId },
      req.user.id,
      { title, content, category },
    );
    res.status(201).json({ note });
  } catch (e) { next(e); }
};

const updateNote = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    if (title !== undefined && String(title).length > 255) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title must be at most 255 characters', statusCode: 400 });
    }
    if (content !== undefined && String(content).length > 5000) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'content must be at most 5000 characters', statusCode: 400 });
    }
    if (category !== undefined && !VALID_NOTE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `category must be one of: ${VALID_NOTE_CATEGORIES.join(', ')}`,
        statusCode: 400,
      });
    }

    const note = await sharedNotesService.updateNote(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.noteId,
      req.user.id,
      { title, content, category },
    );
    res.status(200).json({ note });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    await sharedNotesService.deleteNote(
      { parentType: 'event', parentId: req.params.eventId },
      req.params.noteId,
      req.user.id,
      req.eventMember.role,
    );
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

// ── GET /events/:eventId/reminders ───────────────────────────
const getEventReminders = async (req, res, next) => {
  try {
    const { query: db } = require('../../config/database');
    const result = await db(
      `SELECT id, reminder_type, scheduled_at, sent_at, created_at
       FROM event_reminders
       WHERE event_id = $1 AND sent_at IS NULL
       ORDER BY scheduled_at ASC`,
      [req.params.eventId],
    );
    res.status(200).json({ reminders: result.rows });
  } catch (error) {
    logger.error('GET /events/:eventId/reminders', { eventId: req.params.eventId, error: error.message });
    next(error);
  }
};

const markSectionViewed = async (req, res, next) => {
  try {
    await eventsService.markSectionViewed(req.params.eventId, req.user.id, req.params.section);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Core
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  // Description
  setDescription,
  updateDescription,
  // Archive
  archiveEvent,
  unarchiveEvent,
  // Invites
  inviteMembers,
  getInvite,
  acceptInvite,
  // Members
  getMembers,
  removeMember,
  // Docs
  uploadDoc,
  getDocs,
  deleteDoc,
  // Photos
  uploadPhotos,
  getPhotos,
  deletePhoto,
  // Expenses
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getBalances,
  settle,
  // Polls
  createPoll,
  getPolls,
  vote,
  deletePoll,
  // Notes
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  // Reminders
  getEventReminders,
  // Section views
  markSectionViewed,
};
