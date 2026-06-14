const sharedPhotos = require('../../../shared/photos/photos.service');

const PARENT_TYPE = 'trip';

const uploadPhotos = (tripId, userId, files) =>
  sharedPhotos.uploadPhotos({ parentType: PARENT_TYPE, parentId: tripId }, userId, files);

const getPhotos = (tripId, opts) =>
  sharedPhotos.getPhotos({ parentType: PARENT_TYPE, parentId: tripId }, opts);

const deletePhoto = (photoId, tripId, requesterId, requesterRole) =>
  sharedPhotos.deletePhoto({ photoId, parentType: PARENT_TYPE, parentId: tripId, requesterId, requesterRole });

const reorderTripPhotos = (tripId, items) =>
  sharedPhotos.reorderPhotos({ parentType: PARENT_TYPE, parentId: tripId, activityId: null, items });

const reorderActivityPhotos = (tripId, actId, items) =>
  sharedPhotos.reorderPhotos({ parentType: PARENT_TYPE, parentId: tripId, activityId: actId, items });

module.exports = {
  uploadPhotos,
  getPhotos,
  deletePhoto,
  reorderTripPhotos,
  reorderActivityPhotos,
};
