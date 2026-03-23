const service = require('./notes.service');

const VALID_CATEGORIES = ['general', 'idea', 'important', 'todo'];

// ── GET /trips/:id/notes ──────────────────────────────────────
const getNotes = async (req, res, next) => {
  try {
    const result = await service.getNotes(req.tripMember.tripId, req.user.id);
    res.status(200).json(result); // { notes, total }
  } catch (e) { next(e); }
};

// ── POST /trips/:id/notes ─────────────────────────────────────
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
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        statusCode: 400,
      });
    }

    const note = await service.createNote(req.tripMember.tripId, req.user.id, { title, content, category });
    res.status(201).json({ note });
  } catch (e) { next(e); }
};

// ── PUT /trips/:id/notes/:noteId ──────────────────────────────
const updateNote = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    if (title !== undefined && String(title).length > 255) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title must be at most 255 characters', statusCode: 400 });
    }
    if (content !== undefined && String(content).length > 5000) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'content must be at most 5000 characters', statusCode: 400 });
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        statusCode: 400,
      });
    }

    const note = await service.updateNote(
      req.tripMember.tripId,
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

// ── DELETE /trips/:id/notes/:noteId ──────────────────────────
const deleteNote = async (req, res, next) => {
  try {
    await service.deleteNote(
      req.tripMember.tripId,
      req.params.noteId,
      req.user.id,
      req.tripMember.role,
    );
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

// ── POST /trips/:id/notes/:noteId/favorite ────────────────────
const favoriteNote = async (req, res, next) => {
  try {
    const result = await service.favoriteNote(
      req.tripMember.tripId,
      req.params.noteId,
      req.user.id,
    );
    res.status(200).json(result); // { isFavorited: bool }
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = { getNotes, createNote, updateNote, deleteNote, favoriteNote };
