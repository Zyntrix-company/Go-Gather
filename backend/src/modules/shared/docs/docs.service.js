const { query: db } = require('../../../config/database');
const { deleteFromS3, getPresignedDownloadUrl, uploadToS3, sanitiseFilename } = require('../../../utils/s3.util');
const { validateMimeFromBuffer } = require('../../../middleware/upload.middleware');
const { createAndSendNotifications } = require('../../../utils/fcm.util');
const { v4: uuidv4 } = require('uuid');
const { docMaxCount, docMaxBatch } = require('../../../config/uploadLimits');

const VALID_DOC_MIME_TYPES = [
  'image/jpeg', 'image/png', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv',
];

const assertValidDocFile = (file) => {
  if (!VALID_DOC_MIME_TYPES.includes(file.mimetype) || !validateMimeFromBuffer(file.buffer, file.mimetype)) {
    const e = new Error('Invalid file type. Allowed: JPEG, PNG, PDF, Word, Excel, PowerPoint, TXT, CSV.');
    e.statusCode = 400; e.error = 'INVALID_FILE_TYPE'; throw e;
  }
};

// `maxCount` lets callers cap docs below the global limit (e.g. personal docs = 10).
const uploadDoc = async ({ parentType, parentId, maxCount }, userId, file) => {
  assertValidDocFile(file);

  const cap = maxCount ?? docMaxCount;
  const countResult = await db(
    'SELECT COUNT(*) FROM docs WHERE parent_type = $1 AND parent_id = $2',
    [parentType, parentId],
  );
  if (parseInt(countResult.rows[0].count, 10) >= cap) {
    const e = new Error(`Maximum ${cap} documents allowed`);
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

  // Notify other members — fire-and-forget (group parents only; personal docs have no members).
  if (parentType !== 'user') {
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
  }

  return formatDoc(doc, downloadUrl, userId, actorName, profile?.avatar_url || null);
};

const uploadDocs = async ({ parentType, parentId, maxCount }, userId, files) => {
  if (!files?.length) {
    const e = new Error('At least one file is required');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const cap = maxCount ?? docMaxCount;
  const countResult = await db(
    'SELECT COUNT(*) FROM docs WHERE parent_type = $1 AND parent_id = $2',
    [parentType, parentId],
  );
  const currentCount = parseInt(countResult.rows[0].count, 10);
  if (currentCount + files.length > cap) {
    const e = new Error(
      `Maximum ${cap} documents allowed. You have ${currentCount}; tried to add ${files.length}.`,
    );
    e.statusCode = 422;
    e.error = 'LIMIT_EXCEEDED';
    throw e;
  }

  const uploaded = [];
  for (const file of files) {
    uploaded.push(await uploadDoc({ parentType, parentId, maxCount }, userId, file));
  }
  return { docs: uploaded, total: uploaded.length };
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

const renameDoc = async ({ docId, parentType, parentId, requesterId, requesterRole, newName }) => {
  const trimmed = (newName || '').trim();
  if (!trimmed) {
    const e = new Error('File name cannot be empty'); e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
  }

  const docResult = await db(
    'SELECT * FROM docs WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [docId, parentType, parentId],
  );
  if (docResult.rowCount === 0) {
    const e = new Error('Document not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const doc = docResult.rows[0];

  if (requesterRole !== 'admin' && doc.uploaded_by !== requesterId) {
    const e = new Error('Only the uploader or an admin can rename this document');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  const updated = await db(
    'UPDATE docs SET file_name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [trimmed, docId],
  );

  const updatedDoc = updated.rows[0];
  const downloadUrl = await getPresignedDownloadUrl(updatedDoc.s3_key);

  const profileResult = await db(
    'SELECT full_name, avatar_url FROM profiles WHERE user_id = $1',
    [updatedDoc.uploaded_by],
  );
  const profile = profileResult.rows[0];

  return formatDoc(updatedDoc, downloadUrl, updatedDoc.uploaded_by, profile?.full_name || null, profile?.avatar_url || null);
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

  await deleteFromS3(doc.s3_key);
  await db('DELETE FROM docs WHERE id = $1', [docId]);
};

// Swap the underlying file of an existing doc, keeping its id and display name.
const replaceDoc = async ({ docId, parentType, parentId, requesterId, requesterRole, file }) => {
  assertValidDocFile(file);

  const docResult = await db(
    'SELECT * FROM docs WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [docId, parentType, parentId],
  );
  if (docResult.rowCount === 0) {
    const e = new Error('Document not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const doc = docResult.rows[0];

  if (requesterRole !== 'admin' && doc.uploaded_by !== requesterId) {
    const e = new Error('Only the uploader or an admin can replace this document');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  const safeName = sanitiseFilename(file.originalname);
  const s3Key = `${parentType}s/${parentId}/docs/${uuidv4()}-${safeName}`;
  await uploadToS3(file.buffer, s3Key, file.mimetype);

  // best-effort cleanup of the previous object
  try { await deleteFromS3(doc.s3_key); } catch (_) { /* ignore */ }

  const updated = await db(
    `UPDATE docs
       SET file_url = $1, s3_key = $2, mime_type = $3, file_size_bytes = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [s3Key, s3Key, file.mimetype, file.size, docId],
  );

  const updatedDoc = updated.rows[0];
  const downloadUrl = await getPresignedDownloadUrl(updatedDoc.s3_key);

  const profileResult = await db(
    'SELECT full_name, avatar_url FROM profiles WHERE user_id = $1',
    [updatedDoc.uploaded_by],
  );
  const profile = profileResult.rows[0];

  return formatDoc(updatedDoc, downloadUrl, updatedDoc.uploaded_by, profile?.full_name || null, profile?.avatar_url || null);
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

module.exports = { uploadDoc, uploadDocs, getDocs, deleteDoc, renameDoc, replaceDoc };
