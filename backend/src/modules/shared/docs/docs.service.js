const { query: db } = require('../../../config/database');
const { deleteFromS3, getPresignedDownloadUrl, uploadToS3, sanitiseFilename } = require('../../../utils/s3.util');
const { validateMimeFromBuffer } = require('../../../middleware/upload.middleware');
const { createAndSendNotifications } = require('../../../utils/fcm.util');
const { v4: uuidv4 } = require('uuid');

const MAX_DOCS = 50;

const uploadDoc = async ({ parentType, parentId }, userId, file) => {
  const validTypes = [
    'image/jpeg', 'image/png', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'text/plain', 'text/csv',
  ];
  if (!validTypes.includes(file.mimetype) || !validateMimeFromBuffer(file.buffer, file.mimetype)) {
    const e = new Error('Invalid file type. Allowed: JPEG, PNG, PDF, Word, Excel, PowerPoint, TXT, CSV.');
    e.statusCode = 400; e.error = 'INVALID_FILE_TYPE'; throw e;
  }

  const countResult = await db(
    'SELECT COUNT(*) FROM docs WHERE parent_type = $1 AND parent_id = $2',
    [parentType, parentId],
  );
  if (parseInt(countResult.rows[0].count, 10) >= MAX_DOCS) {
    const e = new Error(`Maximum ${MAX_DOCS} documents allowed`);
    e.statusCode = 422; e.error = 'LIMIT_EXCEEDED'; throw e;
  }

  const safeName = sanitiseFilename(file.originalname);
  const s3Key = `${parentType}s/${parentId}/docs/${uuidv4()}-${safeName}`;

  await uploadToS3(file.buffer, s3Key, file.mimetype);

  const result = await db(
    `INSERT INTO docs (parent_type, parent_id, uploaded_by, file_name, file_url, s3_key, file_size_bytes, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [parentType, parentId, userId, file.originalname, s3Key, s3Key, file.size, file.mimetype],
  );

  const doc = result.rows[0];
  const downloadUrl = await getPresignedDownloadUrl(doc.s3_key);

  const profileResult = await db(
    'SELECT full_name, avatar_url FROM profiles WHERE user_id = $1',
    [userId],
  );
  const profile = profileResult.rows[0];
  const actorName = profile?.full_name || 'Someone';

  // Notify other members — fire-and-forget
  (async () => {
    try {
      const memberTable = parentType === 'trip' ? 'trip_members' : 'event_members';
      const parentCol   = parentType === 'trip' ? 'trip_id'     : 'event_id';
      const parentTable = parentType === 'trip' ? 'trips'       : 'events';
      const [membersResult, parentResult] = await Promise.all([
        db(`SELECT u.id, u.fcm_token FROM ${memberTable} tm JOIN users u ON u.id = tm.user_id WHERE tm.${parentCol} = $1 AND tm.user_id != $2`, [parentId, userId]),
        db(`SELECT name FROM ${parentTable} WHERE id = $1`, [parentId]),
      ]);
      if (membersResult.rows.length === 0) return;
      const parentName = parentResult.rows[0]?.name || 'Your group';
      const dataPayload = parentType === 'trip'
        ? { tripId: parentId, parentName }
        : { eventId: parentId, parentName };
      createAndSendNotifications(
        membersResult.rows,
        { title: 'Document Added', body: `${actorName} added a document to "${parentName}".` },
        'DOCUMENT_UPLOADED',
        dataPayload,
        { batched: true },
      );
    } catch (_) { /* fire-and-forget */ }
  })();

  return formatDoc(doc, downloadUrl, userId, actorName, profile?.avatar_url || null);
};

const getDocs = async ({ parentType, parentId }) => {
  const result = await db(
    `SELECT d.*, p.full_name AS uploader_name, p.avatar_url AS uploader_avatar
     FROM docs d
     LEFT JOIN profiles p ON p.user_id = d.uploaded_by
     WHERE d.parent_type = $1 AND d.parent_id = $2
     ORDER BY d.created_at DESC`,
    [parentType, parentId],
  );

  const docs = await Promise.all(
    result.rows.map(async (doc) => {
      const downloadUrl = await getPresignedDownloadUrl(doc.s3_key);
      return formatDoc(doc, downloadUrl, doc.uploaded_by, doc.uploader_name, doc.uploader_avatar);
    }),
  );

  return { docs, total: docs.length };
};

const deleteDoc = async ({ docId, parentType, parentId, requesterId, requesterRole }) => {
  const docResult = await db(
    'SELECT * FROM docs WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [docId, parentType, parentId],
  );
  if (docResult.rowCount === 0) {
    const e = new Error('Document not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const doc = docResult.rows[0];

  if (doc.uploaded_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the uploader or an admin can delete this document');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  await deleteFromS3(doc.s3_key);
  await db('DELETE FROM docs WHERE id = $1', [docId]);
};

const formatDoc = (doc, downloadUrl, uploadedById, uploaderName, uploaderAvatar) => ({
  id: doc.id,
  parentType: doc.parent_type,
  parentId: doc.parent_id,
  fileName: doc.file_name,
  mimeType: doc.mime_type,
  fileSizeBytes: doc.file_size_bytes,
  downloadUrl,
  uploadedBy: {
    userId: uploadedById || doc.uploaded_by,
    name: uploaderName || null,
    avatarUrl: uploaderAvatar || null,
  },
  createdAt: doc.created_at,
});

module.exports = { uploadDoc, getDocs, deleteDoc };
