const { v4: uuidv4 } = require('uuid');

const { query: db }              = require('../../config/database');
const { encrypt, decrypt }       = require('../../utils/encrypt.util');
const { uploadToS3, sanitiseFilename } = require('../../utils/s3.util');
const { validateMimeFromBuffer } = require('../../middleware/upload.middleware');
const driveProvider              = require('../emailDocs/providers/drive.provider');

// Re-use state helpers from emailDocs service (generateState, validateState, getValidAccessToken)
const emailDocsService = require('../emailDocs/emailDocs.service');

const config = require('../../config');
const { docMaxBytes, docMaxCount, personalDocMaxCount, photoMaxBytes, videoMaxBytes } = require('../../config/uploadLimits');

const MAX_FILE_BYTES = docMaxBytes;
const MAX_PHOTO_BYTES = photoMaxBytes;
const MAX_DOCS = docMaxCount;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

// ── Public exports ──────────────────────────────────────────────────────────

// Expose state helpers from emailDocs service
const { generateState, validateState } = emailDocsService;

async function handleOAuthCallback(code, state) {
  const userId = validateState(state);

  let tokens;
  try {
    tokens = await driveProvider.exchangeCode(code);
  } catch (err) {
    const e = new Error('Failed to exchange OAuth code with Google Drive');
    e.statusCode = 502;
    e.error = 'PROVIDER_ERROR';
    throw e;
  }

  const encryptedAccess  = encrypt(tokens.accessToken);
  const encryptedRefresh = encrypt(tokens.refreshToken);

  await db(
    `INSERT INTO email_oauth_tokens (user_id, provider, access_token, refresh_token, token_expiry, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE
       SET access_token  = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expiry  = EXCLUDED.token_expiry,
           email         = EXCLUDED.email,
           updated_at    = NOW()`,
    [userId, 'drive', encryptedAccess, encryptedRefresh, tokens.expiresAt, tokens.email],
  );

  return { provider: 'drive', email: tokens.email };
}

async function getStatus(userId) {
  const result = await db(
    'SELECT email FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, 'drive'],
  );
  if (result.rowCount === 0) return { connected: false, email: null };
  return { connected: true, email: result.rows[0].email };
}

async function resolveDriveAccessToken(userId) {
  const result = await db(
    'SELECT * FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, 'drive'],
  );
  if (result.rowCount === 0) {
    const e = new Error('Google Drive not connected');
    e.statusCode = 401; e.error = 'NOT_CONNECTED'; throw e;
  }

  const row      = result.rows[0];
  const bufferMs = 5 * 60 * 1000;

  if (new Date(row.token_expiry) > new Date(Date.now() + bufferMs)) {
    return decrypt(row.access_token);
  }

  const plainRefresh = decrypt(row.refresh_token);
  try {
    const newTokens = await driveProvider.refreshAccessToken(plainRefresh);
    const newEncAccess  = encrypt(newTokens.accessToken);
    const newEncRefresh = newTokens.refreshToken ? encrypt(newTokens.refreshToken) : row.refresh_token;
    await db(
      'UPDATE email_oauth_tokens SET access_token=$1, refresh_token=$2, token_expiry=$3, updated_at=NOW() WHERE user_id=$4 AND provider=$5',
      [newEncAccess, newEncRefresh, newTokens.expiresAt, userId, 'drive'],
    );
    return newTokens.accessToken;
  } catch {
    await db('DELETE FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2', [userId, 'drive']);
    const e = new Error('Drive authorization expired — please reconnect');
    e.statusCode = 401; e.error = 'REAUTH_REQUIRED'; throw e;
  }
}

async function listFiles(userId, folderId, { photosOnly = false } = {}) {
  const accessToken = await resolveDriveAccessToken(userId);
  const files = await driveProvider.listFiles(accessToken, folderId, { photosOnly });
  return { files, total: files.length };
}

async function importFiles(userId, parentType, parentId, files) {
  const countRes = await db(
    'SELECT COUNT(*) FROM docs WHERE parent_type = $1 AND parent_id = $2',
    [parentType, parentId],
  );
  const currentCount = parseInt(countRes.rows[0].count, 10);
  const cap = parentType === 'user' ? personalDocMaxCount : MAX_DOCS;
  if (currentCount + files.length > cap) {
    const label = parentType === 'user' ? 'account' : (parentType === 'event' ? 'event' : 'trip');
    const e = new Error(`This ${label} already has ${currentCount} documents. Adding ${files.length} more would exceed the ${cap} document limit.`);
    e.statusCode = 422; e.error = 'LIMIT_EXCEEDED'; throw e;
  }

  const accessToken = await resolveDriveAccessToken(userId);

  const imported = [];
  const failed   = [];

  for (const { fileId, name, mimeType } of files) {
    const fileName = name || 'document';
    try {
      const buffer = await driveProvider.downloadFile(accessToken, fileId);

      if (buffer.length > MAX_FILE_BYTES) {
        failed.push({ fileName, reason: 'FILE_TOO_LARGE' });
        continue;
      }

      // Accept mimeType reported by Drive if it's in our allowed set;
      // fall back to MIME sniffing for images/pdf.
      let resolvedMime = ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : null;
      if (!resolvedMime) {
        // Try sniffing from bytes (images + pdf only)
        for (const allowed of ['application/pdf', 'image/jpeg', 'image/png']) {
          if (validateMimeFromBuffer(buffer, allowed)) { resolvedMime = allowed; break; }
        }
      }
      if (!resolvedMime) {
        failed.push({ fileName, reason: 'INVALID_FILE_TYPE' });
        continue;
      }

      const s3Key = `${parentType}s/${parentId}/docs/${uuidv4()}-${sanitiseFilename(fileName)}`;
      await uploadToS3(buffer, s3Key, resolvedMime);

      const docRes = await db(
        `INSERT INTO docs (parent_type, parent_id, uploaded_by, file_name, file_url, s3_key, file_size_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [parentType, parentId, userId, fileName, s3Key, s3Key, buffer.length, resolvedMime],
      );

      imported.push({ docId: docRes.rows[0].id, fileName, fileUrl: s3Key });
    } catch (err) {
      if (err.error === 'NOT_CONNECTED' || err.error === 'REAUTH_REQUIRED') throw err;
      failed.push({ fileName, reason: err.error || 'UNKNOWN_ERROR' });
    }
  }

  return { imported, failed };
}

async function importPhotos(userId, parentType, parentId, files, { target } = {}) {
  const { getPresignedDownloadUrl } = require('../../utils/s3.util');
  const accessToken = await resolveDriveAccessToken(userId);

  const imported = [];
  const failed   = [];

  for (const { fileId, name, mimeType } of files) {
    const fileName = name || 'photo.jpg';
    try {
      const buffer = await driveProvider.downloadFile(accessToken, fileId);

      if (buffer.length > MAX_PHOTO_BYTES) {
        failed.push({ fileName, reason: 'FILE_TOO_LARGE' });
        continue;
      }

      let resolvedMime = PHOTO_MIME_TYPES.has(mimeType) ? mimeType : null;
      if (!resolvedMime) {
        for (const allowed of PHOTO_MIME_TYPES) {
          if (validateMimeFromBuffer(buffer, allowed)) { resolvedMime = allowed; break; }
        }
      }
      if (!resolvedMime) {
        failed.push({ fileName, reason: 'INVALID_FILE_TYPE' });
        continue;
      }

      const s3Key = `${parentType}s/${parentId}/photos/${uuidv4()}-${sanitiseFilename(fileName)}`;
      await uploadToS3(buffer, s3Key, resolvedMime);

      const fileUrl = config.s3.cloudfrontDomain
        ? `https://${config.s3.cloudfrontDomain}/${s3Key}`
        : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;

      const photoRes = await db(
        `INSERT INTO photos (parent_type, parent_id, uploaded_by, file_url, s3_key, mime_type, activity_id)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         RETURNING id, file_url, s3_key, mime_type, created_at`,
        [parentType, parentId, userId, fileUrl, s3Key, resolvedMime],
      );

      const row = photoRes.rows[0];
      const presignedUrl = config.s3.cloudfrontDomain ? null : await getPresignedDownloadUrl(row.s3_key);
      imported.push({
        id:       row.id,
        fileName,
        fileUrl:  row.file_url,
        url:      presignedUrl || row.file_url,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      });
    } catch (err) {
      if (err.error === 'NOT_CONNECTED' || err.error === 'REAUTH_REQUIRED') throw err;
      failed.push({ fileName, reason: err.error || 'UNKNOWN_ERROR' });
    }
  }

  return { imported, failed };
}

async function disconnect(userId) {
  const result = await db(
    'SELECT access_token FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, 'drive'],
  );
  if (result.rowCount === 0) {
    const e = new Error('No Drive connection found');
    e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  try {
    const plainAccessToken = decrypt(result.rows[0].access_token);
    await driveProvider.revokeToken(plainAccessToken);
  } catch {}
  await db('DELETE FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2', [userId, 'drive']);
}

module.exports = {
  generateState,
  handleOAuthCallback,
  getStatus,
  listFiles,
  importFiles,
  importPhotos,
  disconnect,
};
