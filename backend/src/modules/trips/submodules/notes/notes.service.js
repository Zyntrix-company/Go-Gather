const sharedNotes = require('../../../shared/notes/notes.service');

const PARENT_TYPE = 'trip';

const getNotes = (tripId, userId) =>
  sharedNotes.getNotes({ parentType: PARENT_TYPE, parentId: tripId }, userId);

const createNote = (tripId, userId, body) =>
  sharedNotes.createNote({ parentType: PARENT_TYPE, parentId: tripId }, userId, body);

const updateNote = (tripId, noteId, userId, updates) =>
  sharedNotes.updateNote({ parentType: PARENT_TYPE, parentId: tripId }, noteId, userId, updates);

const deleteNote = (tripId, noteId, userId, userRole) =>
  sharedNotes.deleteNote({ parentType: PARENT_TYPE, parentId: tripId }, noteId, userId, userRole);

const favoriteNote = (tripId, noteId, userId) =>
  sharedNotes.toggleFavorite({ parentType: PARENT_TYPE, parentId: tripId }, noteId, userId);

module.exports = { getNotes, createNote, updateNote, deleteNote, favoriteNote };
