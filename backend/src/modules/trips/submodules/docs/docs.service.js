const sharedDocs = require('../../../shared/docs/docs.service');

const PARENT_TYPE = 'trip';

const uploadDoc = (tripId, userId, file) =>
  sharedDocs.uploadDoc({ parentType: PARENT_TYPE, parentId: tripId }, userId, file);

const uploadDocs = (tripId, userId, files) =>
  sharedDocs.uploadDocs({ parentType: PARENT_TYPE, parentId: tripId }, userId, files);

const getDocs = (tripId) =>
  sharedDocs.getDocs({ parentType: PARENT_TYPE, parentId: tripId });

const deleteDoc = (docId, tripId, requesterId, requesterRole) =>
  sharedDocs.deleteDoc({ docId, parentType: PARENT_TYPE, parentId: tripId, requesterId, requesterRole });

const renameDoc = (docId, tripId, requesterId, requesterRole, newName) =>
  sharedDocs.renameDoc({ docId, parentType: PARENT_TYPE, parentId: tripId, requesterId, requesterRole, newName });

module.exports = { uploadDoc, uploadDocs, getDocs, deleteDoc, renameDoc };
