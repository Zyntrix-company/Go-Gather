const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { query: db } = require('../../config/database');
const config = require('../../config');
const { encrypt, decrypt } = require('../../utils/encrypt.util');
const { uploadToS3, sanitiseFilename } = require('../../utils/s3.util');
const { validateMimeFromBuffer } = require('../../middleware/upload.middleware');

const gmailProvider   = require('./providers/gmail.provider');
const outlookProvider = require('./providers/outlook.provider');

const PROVIDERS = { gmail: gmailProvider, outlook: outlookProvider };
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const { docMaxBytes, docMaxCount, personalDocMaxCount } = require('../../config/uploadLimits');

const MAX_FILE_BYTES = docMaxBytes;
const MAX_DOCS = docMaxCount;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function resolveProvider(provider) {
  const p = PROVIDERS[provider];
  if (!p) {
    const e = new Error('Provider must be gmail or outlook');
    e.statusCode = 400; e.error = 'INVALID_PROVIDER'; throw e;
  }
  return p;
}

// ── CSRF state ─────────────────────────────────────────────────────────────

function generateState(userId) {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', config.jwt.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function validateState(state) {
  let decoded;
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8');
  } catch {
    const e = new Error('Invalid OAuth state'); e.statusCode = 400; e.error = 'INVALID_STATE'; throw e;
  }

  // Format: userId:timestamp:hmac  (UUID has no ':' so split-at-first-two is safe)
  const firstColon  = decoded.indexOf(':');
  const secondColon = decoded.indexOf(':', firstColon + 1);
  if (firstColon === -1 || secondColon === -1) {
    const e = new Error('Malformed OAuth state'); e.statusCode = 400; e.error = 'INVALID_STATE'; throw e;
  }

  const userId        = decoded.slice(0, firstColon);
  const timestamp     = decoded.slice(firstColon + 1, secondColon);
  const receivedHmac  = decoded.slice(secondColon + 1);

  const age = Date.now() - parseInt(timestamp, 10);
  if (age > STATE_TTL_MS || age < 0) {
    const e = new Error('OAuth state expired'); e.statusCode = 400; e.error = 'STATE_EXPIRED'; throw e;
  }

  const expectedHmac = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${userId}:${timestamp}`)
    .digest('hex');

  const expected = Buffer.from(expectedHmac, 'hex');
  const received = Buffer.from(receivedHmac, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    const e = new Error('OAuth state validation failed'); e.statusCode = 400; e.error = 'INVALID_STATE'; throw e;
  }

  return userId;
}

// ── Token management ────────────────────────────────────────────────────────

async function getValidAccessToken(userId, provider) {
  const result = await db(
    'SELECT * FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider],
  );

  if (result.rowCount === 0) {
    const e = new Error('No email account connected for this provider');
    e.statusCode = 401; e.error = 'NOT_CONNECTED'; throw e;
  }

  const row = result.rows[0];
  const bufferMs = 5 * 60 * 1000;

  if (new Date(row.token_expiry) > new Date(Date.now() + bufferMs)) {
    return decrypt(row.access_token);
  }

  // Refresh
  const p = resolveProvider(provider);
  const plainRefresh = decrypt(row.refresh_token);
  let newTokens;
  try {
    newTokens = await p.refreshAccessToken(plainRefresh);
  } catch (err) {
    // If refresh fails (revoked), remove the row so the user is prompted to reconnect
    await db('DELETE FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2', [userId, provider]);
    const e = new Error('Email authorization expired — please reconnect');
    e.statusCode = 401; e.error = 'REAUTH_REQUIRED'; throw e;
  }

  const newEncryptedAccess  = encrypt(newTokens.accessToken);
  const newEncryptedRefresh = newTokens.refreshToken ? encrypt(newTokens.refreshToken) : row.refresh_token;

  await db(
    `UPDATE email_oauth_tokens
     SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = NOW()
     WHERE user_id = $4 AND provider = $5`,
    [newEncryptedAccess, newEncryptedRefresh, newTokens.expiresAt, userId, provider],
  );

  return newTokens.accessToken;
}

// ── MIME inference from buffer ──────────────────────────────────────────────

function inferMimeFromBuffer(buffer) {
  for (const mime of ALLOWED_MIME_TYPES) {
    if (validateMimeFromBuffer(buffer, mime)) return mime;
  }
  return null;
}

// ── Public service functions ────────────────────────────────────────────────

async function handleOAuthCallback(provider, code, state) {
  const userId = validateState(state);
  const p = resolveProvider(provider);

  let tokens;
  try {
    tokens = await p.exchangeCode(code);
  } catch (err) {
    const e = new Error('Failed to exchange OAuth code with provider');
    e.statusCode = 502; e.error = 'PROVIDER_ERROR'; throw e;
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
    [userId, provider, encryptedAccess, encryptedRefresh, tokens.expiresAt, tokens.email],
  );

  return { provider, email: tokens.email };
}

async function getStatus(userId) {
  const result = await db(
    'SELECT provider, email FROM email_oauth_tokens WHERE user_id = $1',
    [userId],
  );

  const status = {
    gmail:   { connected: false, email: null },
    outlook: { connected: false, email: null },
  };

  for (const row of result.rows) {
    status[row.provider] = { connected: true, email: row.email };
  }

  return status;
}

async function listAttachments(userId, provider) {
  const p = resolveProvider(provider);
  const accessToken = await getValidAccessToken(userId, provider);
  const all = await p.getAttachments(accessToken);

  const filtered = all.filter(
    (a) => ALLOWED_MIME_TYPES.has(a.mimeType) && a.fileSizeBytes <= MAX_FILE_BYTES,
  );

  return { attachments: filtered, total: filtered.length };
}

async function importAttachments(userId, parentType, parentId, attachments) {
  // Check doc cap
  const countRes = await db(
    'SELECT COUNT(*) FROM docs WHERE parent_type = $1 AND parent_id = $2',
    [parentType, parentId],
  );
  const currentCount = parseInt(countRes.rows[0].count, 10);
  const cap = parentType === 'user' ? personalDocMaxCount : MAX_DOCS;
  if (currentCount + attachments.length > cap) {
    const label = parentType === 'user' ? 'account' : (parentType === 'event' ? 'event' : 'trip');
    const e = new Error(`This ${label} already has ${currentCount} documents. Adding ${attachments.length} more would exceed the ${cap} document limit.`);
    e.statusCode = 422; e.error = 'LIMIT_EXCEEDED'; throw e;
  }

  const imported = [];
  const failed   = [];

  for (const { provider, messageId, attachmentId, fileName } of attachments) {
    try {
      const p = resolveProvider(provider);
      const accessToken = await getValidAccessToken(userId, provider);

      // Download
      const buffer = await p.downloadAttachment(accessToken, messageId, attachmentId);

      // Validate size before further processing
      if (buffer.length > MAX_FILE_BYTES) {
        failed.push({ fileName, reason: 'FILE_TOO_LARGE' });
        continue;
      }

      // Validate MIME from actual bytes — ignore provider metadata
      const mimeType = inferMimeFromBuffer(buffer);
      if (!mimeType) {
        failed.push({ fileName, reason: 'INVALID_FILE_TYPE' });
        continue;
      }

      // Upload to S3
      const s3Key = `${parentType}s/${parentId}/docs/${uuidv4()}-${sanitiseFilename(fileName)}`;
      await uploadToS3(buffer, s3Key, mimeType);

      // Insert into docs table
      const docRes = await db(
        `INSERT INTO docs (parent_type, parent_id, uploaded_by, file_name, file_url, s3_key, file_size_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [parentType, parentId, userId, fileName, s3Key, s3Key, buffer.length, mimeType],
      );

      imported.push({ docId: docRes.rows[0].id, fileName, fileUrl: s3Key });
    } catch (err) {
      // If we already classified the error (REAUTH etc.), propagate structured errors upward;
      // individual download/upload failures are reported in the failed array
      if (err.error === 'NOT_CONNECTED' || err.error === 'REAUTH_REQUIRED') throw err;
      failed.push({ fileName, reason: err.error || 'UNKNOWN_ERROR' });
    }
  }

  return { imported, failed };
}

async function disconnect(userId, provider) {
  const p = resolveProvider(provider);

  const result = await db(
    'SELECT access_token FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider],
  );

  if (result.rowCount === 0) {
    const e = new Error('No connection found for this provider');
    e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  // Best-effort revocation — do not fail if the provider call errors
  try {
    const plainAccessToken = decrypt(result.rows[0].access_token);
    await p.revokeToken(plainAccessToken);
  } catch {}

  await db(
    'DELETE FROM email_oauth_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider],
  );
}

module.exports = {
  generateState,
  validateState,
  handleOAuthCallback,
  getStatus,
  listAttachments,
  importAttachments,
  disconnect,
};
