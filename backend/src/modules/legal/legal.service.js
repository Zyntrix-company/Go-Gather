const sanitizeHtml = require('sanitize-html');
const db = require('../../config/database');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const SANITIZE_OPTS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'div', 'span', 'table',
    'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

const isValidSemverThree = (v) => typeof v === 'string' && SEMVER_RE.test(v.trim());

const suggestNextPatch = (version) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec((version || '').trim());
  if (!m) return '1.0.0';
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
};

const sanitizeLegalHtml = (html) => sanitizeHtml(String(html || ''), SANITIZE_OPTS);

const mapRowToPublic = (row) => ({
  documentType: row.document_type,
  version: row.version,
  effectiveAt: row.effective_at,
  contentHtml: row.content_html,
  title: row.document_type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',
});

/**
 * Current published document for public API / app / marketing site.
 */
const getCurrentPublished = async (documentType) => {
  const { rows } = await db.query(
    `SELECT document_type, version, content_html, effective_at, published_at
       FROM legal_document_versions
      WHERE document_type = $1 AND is_current = true
      LIMIT 1`,
    [documentType],
  );
  return rows[0] ? mapRowToPublic(rows[0]) : null;
};

/**
 * List published versions (newest first) for admin history.
 */
const listVersions = async (documentType) => {
  const { rows } = await db.query(
    `SELECT id, document_type, version, effective_at, published_at, is_current, created_at
       FROM legal_document_versions
      WHERE document_type = $1 AND published_at IS NOT NULL
      ORDER BY published_at DESC, created_at DESC`,
    [documentType],
  );
  return rows.map((r) => ({
    id: r.id,
    documentType: r.document_type,
    version: r.version,
    effectiveAt: r.effective_at,
    publishedAt: r.published_at,
    isCurrent: r.is_current,
    createdAt: r.created_at,
  }));
};

const getSuggestedNextVersion = async (documentType) => {
  const cur = await getCurrentPublished(documentType);
  if (!cur) return '1.0.0';
  return suggestNextPatch(cur.version);
};

/**
 * Publish a new version: unset previous current, insert row, enqueue notification emails.
 */
const publishVersion = async ({
  documentType, version, contentHtml, effectiveAt,
}) => {
  if (!['privacy', 'terms'].includes(documentType)) {
    const err = new Error('Invalid documentType');
    err.statusCode = 400;
    throw err;
  }
  const ver = String(version || '').trim();
  if (!isValidSemverThree(ver)) {
    const err = new Error('version must match MAJOR.MINOR.PATCH (digits only)');
    err.statusCode = 400;
    err.error = 'InvalidVersion';
    throw err;
  }

  const html = sanitizeLegalHtml(contentHtml);
  if (!html || html.length < 20) {
    const err = new Error('contentHtml is too short after sanitization');
    err.statusCode = 400;
    throw err;
  }

  const eff = effectiveAt ? new Date(effectiveAt) : new Date();
  if (Number.isNaN(eff.getTime())) {
    const err = new Error('effectiveAt is invalid');
    err.statusCode = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const dup = await client.query(
      'SELECT id FROM legal_document_versions WHERE document_type = $1 AND version = $2',
      [documentType, ver],
    );
    if (dup.rows.length > 0) {
      const err = new Error('This version number already exists for this document');
      err.statusCode = 409;
      err.error = 'VersionExists';
      throw err;
    }

    await client.query(
      'UPDATE legal_document_versions SET is_current = false WHERE document_type = $1',
      [documentType],
    );

    const ins = await client.query(
      `INSERT INTO legal_document_versions
        (document_type, version, content_html, effective_at, published_at, is_current)
       VALUES ($1, $2, $3, $4, NOW(), true)
       RETURNING id, document_type, version, effective_at, published_at`,
      [documentType, ver, html, eff],
    );

    await client.query(
      `INSERT INTO legal_notification_jobs (document_type, version)
       VALUES ($1, $2)
       ON CONFLICT (document_type, version) DO NOTHING`,
      [documentType, ver],
    );

    await client.query('COMMIT');
    const row = ins.rows[0];
    return mapRowToPublic({
      document_type: row.document_type,
      version: row.version,
      content_html: html,
      effective_at: row.effective_at,
      published_at: row.published_at,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Stamp new user with current published versions (auth signup / OAuth create).
 */
const syncUserLegalAckFromCurrent = async (userId, client = db) => {
  const { rows } = await client.query(
    'SELECT document_type, version FROM legal_document_versions WHERE is_current = true',
  );
  const privacy = rows.find((r) => r.document_type === 'privacy')?.version ?? null;
  const terms = rows.find((r) => r.document_type === 'terms')?.version ?? null;
  if (!privacy && !terms) return;

  await client.query(
    `UPDATE users SET
       privacy_policy_ack_version = COALESCE($2, privacy_policy_ack_version),
       terms_ack_version = COALESCE($3, terms_ack_version),
       privacy_policy_ack_at = CASE WHEN $2::text IS NOT NULL THEN NOW() ELSE privacy_policy_ack_at END,
       terms_ack_at = CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE terms_ack_at END,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, privacy, terms],
  );
};

module.exports = {
  SEMVER_RE,
  isValidSemverThree,
  suggestNextPatch,
  sanitizeLegalHtml,
  getCurrentPublished,
  listVersions,
  getSuggestedNextVersion,
  publishVersion,
  syncUserLegalAckFromCurrent,
};
