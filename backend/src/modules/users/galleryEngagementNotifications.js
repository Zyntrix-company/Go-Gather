const db = require('../../config/database');
const logger = require('../../utils/logger');
const { createAndSendNotification, createAndSendNotifications } = require('../../utils/fcm.util');
const galleryAlbumsService = require('./galleryAlbums.service');

const PARENT_TYPE_GALLERY_ALBUM = 'gallery_album';

const fetchActorName = async (userId) => {
  const result = await db.query(
    `SELECT COALESCE(p.full_name, u.username, 'Traveler') AS user_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  return result.rows[0]?.user_name || 'Someone';
};

const resolveAlbumContext = async (parentType, parentId) => {
  if (parentType === PARENT_TYPE_GALLERY_ALBUM) {
    const album = await galleryAlbumsService.getAlbumById(parentId);
    const ownerResult = await db.query(
      `SELECT COALESCE(p.full_name, u.username, 'Traveler') AS user_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [album.user_id],
    );
    return {
      albumName: album.name,
      albumOwnerId: album.user_id,
      albumOwnerName: ownerResult.rows[0]?.user_name || 'Friend',
      parentKind: 'gallery_album',
      dataBase: {
        parentType: PARENT_TYPE_GALLERY_ALBUM,
        parentId,
        albumOwnerId: album.user_id,
        albumOwnerName: ownerResult.rows[0]?.user_name || 'Friend',
        screen: 'gallery',
      },
    };
  }

  if (parentType === 'trip') {
    const result = await db.query('SELECT name FROM trips WHERE id = $1', [parentId]);
    const albumName = result.rows[0]?.name || 'Trip album';
    return {
      albumName,
      parentKind: 'trip',
      dataBase: {
        parentType: 'trip',
        parentId,
        tripId: parentId,
        tripName: albumName,
        screen: 'gallery',
      },
    };
  }

  if (parentType === 'event') {
    const result = await db.query('SELECT name FROM events WHERE id = $1', [parentId]);
    const albumName = result.rows[0]?.name || 'Event album';
    return {
      albumName,
      parentKind: 'event',
      dataBase: {
        parentType: 'event',
        parentId,
        eventId: parentId,
        eventName: albumName,
        screen: 'gallery',
      },
    };
  }

  return null;
};

const resolveRecipients = async (actorId, parentType, parentId) => {
  if (parentType === PARENT_TYPE_GALLERY_ALBUM) {
    const album = await galleryAlbumsService.getAlbumById(parentId);
    if (album.user_id === actorId) return [];
    return [{ id: album.user_id }];
  }

  const memberTable = parentType === 'trip' ? 'trip_members' : 'event_members';
  const parentCol = parentType === 'trip' ? 'trip_id' : 'event_id';
  const result = await db.query(
    `SELECT u.id
     FROM ${memberTable} tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.${parentCol} = $1 AND tm.user_id != $2`,
    [parentId, actorId],
  );
  return result.rows.map((r) => ({ id: r.id }));
};

const buildDataPayload = (ctx, extras = {}) => ({
  ...ctx.dataBase,
  parentName: ctx.albumName,
  albumName: ctx.albumName,
  parentKind: ctx.parentKind,
  ...extras,
});

const notifyGalleryLiked = (actorId, parentType, parentId) => {
  setImmediate(async () => {
    try {
      const ctx = await resolveAlbumContext(parentType, parentId);
      if (!ctx) return;

      const recipients = await resolveRecipients(actorId, parentType, parentId);
      if (recipients.length === 0) return;

      const actorName = await fetchActorName(actorId);
      const notification = {
        title: 'Gallery Activity',
        body: `${actorName} liked "${ctx.albumName}"`,
      };
      const data = buildDataPayload(ctx, { actorUserId: actorId });

      if (recipients.length === 1) {
        await createAndSendNotification(
          recipients[0].id,
          notification,
          'GALLERY_LIKED',
          data,
          { batched: true },
        );
      } else {
        await createAndSendNotifications(
          recipients,
          notification,
          'GALLERY_LIKED',
          data,
          { batched: true },
        );
      }
    } catch (err) {
      logger.error('GALLERY_LIKED notification failed', { parentType, parentId, error: err.message });
    }
  });
};

const notifyGalleryComment = (actorId, parentType, parentId, commentText, commentId) => {
  setImmediate(async () => {
    try {
      const ctx = await resolveAlbumContext(parentType, parentId);
      if (!ctx) return;

      const recipients = await resolveRecipients(actorId, parentType, parentId);
      if (recipients.length === 0) return;

      const actorName = await fetchActorName(actorId);
      const notification = {
        title: 'New Gallery Comment',
        body: `${actorName} commented on "${ctx.albumName}": ${commentText}`,
      };
      const data = buildDataPayload(ctx, { actorUserId: actorId, commentId });

      if (recipients.length === 1) {
        await createAndSendNotification(recipients[0].id, notification, 'GALLERY_COMMENT', data);
      } else {
        await createAndSendNotifications(recipients, notification, 'GALLERY_COMMENT', data);
      }
    } catch (err) {
      logger.error('GALLERY_COMMENT notification failed', { parentType, parentId, error: err.message });
    }
  });
};

module.exports = {
  notifyGalleryLiked,
  notifyGalleryComment,
  resolveRecipients,
  resolveAlbumContext,
};
