const sharedDocs = require('../../../shared/docs/docs.service');

const PARENT_TYPE = 'trip';

const uploadDoc = (tripId, userId, file) =>
  sharedDocs.uploadDoc({ parentType: PARENT_TYPE, parentId: tripId }, userId, file);

const getDocs = (tripId) =>
  sharedDocs.getDocs({ parentType: PARENT_TYPE, parentId: tripId });

const deleteDoc = (docId, tripId, requesterId, requesterRole) =>
  sharedDocs.deleteDoc({ docId, parentType: PARENT_TYPE, parentId: tripId, requesterId, requesterRole });

module.exports = { uploadDoc, getDocs, deleteDoc };
