const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { GetSendQuotaCommand } = require('@aws-sdk/client-ses');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { GoogleAuth } = require('google-auth-library');
const authenticateJWT = require('../../middleware/authenticate');
const { requireAnyAdmin, requireFullAdminRole, getCount30m } = require('./admin.middleware');
const { blogImageUpload, dealImageUpload, promoVideoUpload, handleMulterError } = require('../../middleware/upload.middleware');
const { query } = require('../../config/database');
const { sesClient, s3Client } = require('../../config/aws');
const { uploadToS3, deleteFromS3, sanitiseFilename } = require('../../utils/s3.util');
const { compressAndReplaceVideoAsync } = require('../../utils/videoCompression.util');
const { resolveAuthEmail } = require('../../utils/email.util');
const config = require('../../config');
const { EMAIL_PROVIDER } = require('../../config/emailProvider');
const logger = require('../../utils/logger');
const legalService = require('../legal/legal.service');
const { getStorageAggregates } = require('./storage.service');
const { setMaintenanceMode } = require('./maintenance.service');

const PASSWORD_SALT_ROUNDS = 12;

const router = express.Router();
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

router.use(authenticateJWT, requireAnyAdmin);

/* ─── Current admin identity (role-aware nav on the frontend) ──── */

router.get('/me', (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.adminRole });
});

/* ─── Helpers ────────────────────────────────────────────────── */

/** Parses an admin-panel date-range query (?from=&to=&label=) into ISO bounds. Falls back to nulls (→ last 30 days) when absent/invalid. */
function parseDateRange(query) {
  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  const label = typeof query.label === 'string' && query.label.trim()
    ? query.label.trim().slice(0, 60)
    : 'within the last 30 days';
  return { from, to, label };
}

function mapBlog(row) {
  return {
    id: row.id, slug: row.slug, image: row.image, title: row.title,
    excerpt: row.excerpt, content: row.content, category: row.category,
    author: row.author, publishedAt: row.published_at,
    published: row.published, showOnWeb: row.show_on_web, showOnApp: row.show_on_app,
    sortOrderWeb: row.sort_order_web, sortOrderApp: row.sort_order_app,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/* ─── Business Insights: summary ────────────────────────────── */

router.get('/dashboard/summary', async (req, res, next) => {
  const { from, to, label } = parseDateRange(req.query);
  try {
    const { rows } = await query(`
      SELECT
        -- Registered users (exclude platform admins from count)
        (SELECT COUNT(*) FROM users WHERE is_platform_admin = false)                     AS registered_users,
        -- Active users: logged in within the selected range (non-admin)
        (SELECT COUNT(*) FROM users
          WHERE is_platform_admin = false
            AND last_login_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
            AND last_login_at <= COALESCE($2::timestamptz, NOW()))                       AS active_users,

        -- Trips buckets
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND start_date > NOW())    AS trips_upcoming,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL
          AND start_date <= NOW() AND end_date >= NOW())                                 AS trips_active,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND end_date < NOW())      AS trips_completed,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NOT NULL)                       AS trips_archived,

        -- Events buckets
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date > CURRENT_DATE)   AS events_upcoming,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL
          AND event_date = CURRENT_DATE)                                                         AS events_active,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date < CURRENT_DATE)    AS events_completed,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NOT NULL)                              AS events_archived,

        -- Contact
        (SELECT COUNT(*) FROM contact_submissions)                                       AS contact_total,
        (SELECT COUNT(*) FROM contact_submissions WHERE read_at IS NULL)                 AS contact_unread
    `, [from, to]);

    const r = rows[0];
    res.json({
      users: {
        registered: Number(r.registered_users),
        active: Number(r.active_users),
        activeDefinition: `Signed in ${label} (admins excluded)`,
      },
      trips: {
        upcoming:  Number(r.trips_upcoming),
        active:    Number(r.trips_active),
        completed: Number(r.trips_completed),
        archived:  Number(r.trips_archived),
      },
      events: {
        upcoming:  Number(r.events_upcoming),
        active:    Number(r.events_active),
        completed: Number(r.events_completed),
        archived:  Number(r.events_archived),
      },
      contact: {
        total:  Number(r.contact_total),
        unread: Number(r.contact_unread),
      },
    });
  } catch (err) { next(err); }
});

/* ─── Business Insights: growth time-series ─────────────────── */

router.get('/dashboard/growth', async (req, res, next) => {
  const { from, to, label } = parseDateRange(req.query);
  try {
    const [usersRes, tripsRes, eventsRes] = await Promise.all([
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM users WHERE is_platform_admin = false
             AND created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
             AND created_at <= COALESCE($2::timestamptz, NOW())
           GROUP BY 1 ORDER BY 1`, [from, to],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM trips WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
             AND created_at <= COALESCE($2::timestamptz, NOW())
           GROUP BY 1 ORDER BY 1`, [from, to],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM events WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
             AND created_at <= COALESCE($2::timestamptz, NOW())
           GROUP BY 1 ORDER BY 1`, [from, to],
      ),
    ]);
    res.json({ label, users: usersRes.rows, trips: tripsRes.rows, events: eventsRes.rows });
  } catch (err) { next(err); }
});

/* ─── Users list ─────────────────────────────────────────────── */

router.get('/users', requireFullAdminRole, async (req, res, next) => {
  const page  = Math.max(parseInt(req.query.page,  10) || 1,   1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    const [listRes, countRes] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.is_verified, u.is_profile_complete,
                u.is_platform_admin, u.is_content_admin, u.created_at, u.last_login_at,
                p.full_name, p.country,
                COALESCE(t.trip_count, 0)::int AS trip_count,
                COALESCE(e.event_count, 0)::int AS event_count
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
           LEFT JOIN (SELECT created_by, COUNT(*) AS trip_count FROM trips GROUP BY created_by) t ON t.created_by = u.id
           LEFT JOIN (SELECT created_by, COUNT(*) AS event_count FROM events GROUP BY created_by) e ON e.created_by = u.id
          WHERE u.is_platform_admin = false AND u.deleted_at IS NULL
            AND ($1::text IS NULL OR u.email ILIKE $1 OR p.full_name ILIKE $1)
          ORDER BY u.last_login_at DESC NULLS LAST
          LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE u.is_platform_admin = false AND u.deleted_at IS NULL
            AND ($1::text IS NULL OR u.email ILIKE $1 OR p.full_name ILIKE $1)`,
        [search],
      ),
    ]);
    res.json({ users: listRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (err) { next(err); }
});

/* ─── Users: create content admin ───────────────────────────── */
// Open to any admin (full or content) — a content admin can only ever mint
// another content admin here, never a platform admin, so this isn't a
// privilege-escalation path.

router.post('/users/content-admin', async (req, res, next) => {
  const { fullName, email } = req.body || {};
  const trimmedName = typeof fullName === 'string' ? fullName.trim() : '';
  if (!trimmedName) return res.status(400).json({ error: 'fullName is required' });

  const resolved = resolveAuthEmail(email);
  if (!resolved) return res.status(400).json({ error: 'A valid email is required' });
  const { display: displayEmail, normalized } = resolved;

  try {
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE email_normalized = $1',
      [normalized],
    );
    if (existing.length) return res.status(409).json({ error: 'A user with this email already exists' });

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, PASSWORD_SALT_ROUNDS);

    const { rows } = await query(
      `INSERT INTO users
         (email, email_normalized, password_hash, is_verified, is_profile_complete,
          is_content_admin, password_reset_recommended)
       VALUES ($1, $2, $3, true, true, true, true)
       RETURNING id, email`,
      [displayEmail, normalized, passwordHash],
    );
    const user = rows[0];

    await query('INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)', [user.id, trimmedName]);

    logger.info('Admin created content admin account', { userId: user.id, actorId: req.user.id });
    res.status(201).json({ id: user.id, email: user.email, tempPassword });
  } catch (err) { next(err); }
});

/* ─── Users: update ──────────────────────────────────────────── */

router.patch('/users/:id', requireFullAdminRole, async (req, res, next) => {
  const { id } = req.params;
  const { is_platform_admin, is_content_admin } = req.body;
  if (is_platform_admin === undefined && is_content_admin === undefined) {
    return res.status(400).json({ error: 'is_platform_admin and/or is_content_admin must be provided as booleans' });
  }
  if (is_platform_admin !== undefined && typeof is_platform_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_platform_admin must be boolean' });
  }
  if (is_content_admin !== undefined && typeof is_content_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_content_admin must be boolean' });
  }
  try {
    if (is_platform_admin === false) {
      const { rows } = await query(
        'SELECT COUNT(*)::int AS cnt FROM users WHERE is_platform_admin = true AND id != $1',
        [id],
      );
      if (rows[0].cnt === 0) return res.status(400).json({ error: 'Cannot remove the last platform admin' });
    }
    const sets = ['updated_at = NOW()']; const vals = [];
    if (is_platform_admin !== undefined) { vals.push(is_platform_admin); sets.push(`is_platform_admin = $${vals.length}`); }
    if (is_content_admin !== undefined) { vals.push(is_content_admin); sets.push(`is_content_admin = $${vals.length}`); }
    vals.push(id);
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, email, is_platform_admin, is_content_admin`,
      vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/* ─── Users: anonymize / delete ──────────────────────────────── */

router.delete('/users/:id', requireFullAdminRole, async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows: existing } = await query('SELECT is_platform_admin, deleted_at FROM users WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    if (existing[0].is_platform_admin) return res.status(400).json({ error: 'Cannot delete a platform admin account' });
    if (existing[0].deleted_at) return res.status(400).json({ error: 'User already deleted' });

    // Anonymize rather than hard-delete: trips/events this user created
    // (trips.created_by is ON DELETE CASCADE) must survive for other participants.
    const anonymizedEmail = `deleted-${id}@removed.gatherrgo.local`;
    await query(
      `UPDATE users SET
         email = $1, email_normalized = $1, phone = NULL, password_hash = NULL,
         is_verified = false, fcm_token = NULL, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [anonymizedEmail, id],
    );
    await query(
      `UPDATE profiles SET full_name = NULL, avatar_url = NULL, dob = NULL,
         gender = NULL, country = NULL, bio = NULL
       WHERE user_id = $1`,
      [id],
    );
    logger.info('Admin anonymized user account', { userId: id, actorId: req.user.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ─── Trips & Events detail ──────────────────────────────────── */

router.get('/trips-events', requireFullAdminRole, async (req, res, next) => {
  const { from, to, label } = parseDateRange(req.query);
  const hasRange = Boolean(req.query.from || req.query.to);
  try {
    const { rows } = await query(`
      SELECT
        -- Trips (scoped to trips created within the range, when given)
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND start_date > NOW()
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS trips_upcoming,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL
          AND start_date <= NOW() AND end_date >= NOW()
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS trips_active,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND end_date < NOW()
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS trips_completed,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NOT NULL
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS trips_archived,
        (SELECT COUNT(*) FROM trips
          WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS trips_total,

        -- Events (scoped to events created within the range, when given)
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date > CURRENT_DATE
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS events_upcoming,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL
          AND event_date = CURRENT_DATE
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS events_active,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date < CURRENT_DATE
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS events_completed,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NOT NULL
          AND created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))    AS events_archived,
        (SELECT COUNT(*) FROM events
          WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS events_total,

        -- Shared activity (scoped to its own created_at within the range)
        (SELECT COUNT(*) FROM expenses WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS total_expenses,
        (SELECT COUNT(*) FROM photos   WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS total_photos,
        (SELECT COUNT(*) FROM docs     WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS total_docs,
        (SELECT COUNT(*) FROM notes    WHERE created_at >= COALESCE($1::timestamptz, '-infinity') AND created_at <= COALESCE($2::timestamptz, 'infinity'))  AS total_notes
    `, [from, to]);
    const r = rows[0];
    res.json({
      range: hasRange ? { from, to, label } : null,
      trips: {
        total:     Number(r.trips_total),
        upcoming:  Number(r.trips_upcoming),
        active:    Number(r.trips_active),
        completed: Number(r.trips_completed),
        archived:  Number(r.trips_archived),
      },
      events: {
        total:     Number(r.events_total),
        upcoming:  Number(r.events_upcoming),
        active:    Number(r.events_active),
        completed: Number(r.events_completed),
        archived:  Number(r.events_archived),
      },
      activity: {
        expenses: Number(r.total_expenses),
        photos:   Number(r.total_photos),
        docs:     Number(r.total_docs),
        notes:    Number(r.total_notes),
      },
    });
  } catch (err) { next(err); }
});

/* ─── Services health ────────────────────────────────────────── */

router.get('/health', requireFullAdminRole, async (_req, res) => {
  const cfg = config;
  const result = {
    timestamp:   new Date().toISOString(),
    requests30m: getCount30m(),

    // Infrastructure (live checks)
    api:     'ok',
    db:      'unknown',
    storage: 'unknown',

    // Communication (live checks)
    email: 'unknown',
    fcm:   'unknown',

    // Communication (config checks)
    sns: cfg.sns.platformAppArnIos || cfg.sns.platformAppArnAndroid
      ? 'configured' : 'not_configured',

    // Auth & OAuth (config checks)
    googleOAuth:    cfg.google.clientId    && cfg.google.clientSecret    ? 'configured' : 'not_configured',
    facebookOAuth:  cfg.facebook.appId     && cfg.facebook.appSecret     ? 'configured' : 'not_configured',
    microsoftOAuth: cfg.microsoft.clientId && cfg.microsoft.clientSecret ? 'configured' : 'not_configured',

    // Integrations (config checks)
    gemini: cfg.gemini.apiKey ? 'configured' : 'not_configured',
    geminiOpsNote: cfg.gemini.apiKey
      ? 'Check Google AI Studio → Rate limits weekly (RPM/RPD/TPM). Watch logs for swee rate_limited and ALERT swee.chat.error_rate_high.'
      : null,
    sweeCircuit: (() => {
      try {
        const cb = require('../ai/swee.circuitBreaker');
        return cb.getStatus();
      } catch { return null; }
    })(),
    sweeMetrics: (() => {
      try {
        const m = require('../ai/swee.metrics');
        return m.getSnapshot();
      } catch { return null; }
    })(),
    branch: cfg.branch.key && cfg.branch.secret ? 'configured' : 'not_configured',
  };

  // Database
  try { await query('SELECT 1'); result.db = 'ok'; }
  catch { result.db = 'error'; }

  // S3 — HeadBucket is a lightweight read, no data returned
  if (!cfg.s3.bucket) {
    result.storage = 'not_configured';
  } else {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: cfg.s3.bucket }));
      result.storage = 'ok';
    } catch (e) {
      result.storage = e.name === 'CredentialsProviderError' ? 'not_configured' : 'error';
    }
  }

  // Email — provider selected in config/emailProvider.js (not env)
  if (EMAIL_PROVIDER === 'brevo') {
    result.email = (cfg.brevo.apiKey && cfg.brevo.fromEmail) ? 'ok' : 'not_configured';
  } else {
    // SES — GetSendQuota is read-only, sends nothing
    try {
      await sesClient.send(new GetSendQuotaCommand({}));
      result.email = 'ok';
    } catch (e) {
      result.email = (e.name === 'CredentialsProviderError' || e.Code === 'AuthFailure')
        ? 'not_configured' : 'error';
    }
  }

  // FCM — OAuth token fetch only, no push sent
  const b64       = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let fcmAuth = null;
  if (b64) {
    try {
      const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      fcmAuth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
    } catch { result.fcm = 'error'; }
  } else if (credsPath) {
    fcmAuth = new GoogleAuth({ keyFilename: credsPath, scopes: [FCM_SCOPE] });
  }
  if (!fcmAuth) {
    if (result.fcm === 'unknown') result.fcm = 'not_configured';
  } else {
    try {
      const client = await fcmAuth.getClient();
      await client.getAccessToken();
      result.fcm = 'ok';
    } catch { result.fcm = 'error'; }
  }

  res.json(result);
});

/* ─── Emergency stop (maintenance mode) ──────────────────────── */
// Platform admins only — this takes the whole product down for every user.

router.get('/system/status', requireFullAdminRole, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.maintenance_mode, s.reason, s.enabled_at, u.email AS enabled_by_email
         FROM system_settings s
         LEFT JOIN users u ON u.id = s.enabled_by
        WHERE s.id = 1`,
    );
    const r = rows[0] || { maintenance_mode: false };
    res.json({
      active: r.maintenance_mode,
      reason: r.reason,
      enabledAt: r.enabled_at,
      enabledByEmail: r.enabled_by_email,
    });
  } catch (err) { next(err); }
});

router.post('/system/stop', requireFullAdminRole, async (req, res, next) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) || null : null;
  try {
    const info = await setMaintenanceMode(true, { userId: req.user.id, reason });
    logger.warn('EMERGENCY STOP: maintenance mode enabled — all non-admin traffic is now blocked', {
      actorId: req.user.id, actorEmail: req.user.email, reason,
    });
    res.json(info);
  } catch (err) { next(err); }
});

router.post('/system/resume', requireFullAdminRole, async (req, res, next) => {
  try {
    const info = await setMaintenanceMode(false, { userId: req.user.id });
    logger.warn('Maintenance mode disabled — services resumed', {
      actorId: req.user.id, actorEmail: req.user.email,
    });
    res.json(info);
  } catch (err) { next(err); }
});

/* ─── Storage & Capacity ─────────────────────────────────────── */

router.get('/storage', requireFullAdminRole, async (req, res, next) => {
  try {
    const agg = await getStorageAggregates();
    const { totalBytes, userCount } = agg;
    const effectiveUserCount = userCount || 1;
    const quota = parseInt(process.env.STORAGE_QUOTA_BYTES, 10) || 0;

    res.json({
      summary: {
        totalBytes,
        totalMB:  (totalBytes / 1024 / 1024).toFixed(2),
        totalGB:  (totalBytes / 1024 / 1024 / 1024).toFixed(3),
      },
      docs: {
        count:      agg.docsCount,
        totalBytes: agg.docsBytes,
        totalMB:    (agg.docsBytes / 1024 / 1024).toFixed(2),
        breakdown:  agg.docsBreakdown.map((r) => ({
          mimeType:  r.mime_type,
          count:     Number(r.type_count),
          bytes:     Number(r.type_bytes),
          mb:        (Number(r.type_bytes) / 1024 / 1024).toFixed(2),
        })),
      },
      images: {
        count:      agg.imagesCount,
        totalBytes: agg.imagesBytes,
        totalMB:    (agg.imagesBytes / 1024 / 1024).toFixed(2),
        breakdown:  agg.imagesBreakdown.map((r) => ({
          mimeType:  r.mime_type,
          count:     Number(r.type_count),
          bytes:     Number(r.type_bytes),
          mb:        (Number(r.type_bytes) / 1024 / 1024).toFixed(2),
        })),
        note: 'Byte totals only cover uploads after migration 030; earlier rows have NULL size.',
      },
      users: userCount,
      averageBytesPerUser:  Math.round(totalBytes / effectiveUserCount),
      averageMBPerUser:     (totalBytes / 1024 / 1024 / effectiveUserCount).toFixed(2),
      quota: quota ? {
        totalBytes:    quota,
        totalGB:       (quota / 1024 / 1024 / 1024).toFixed(2),
        usedBytes:     totalBytes,
        availableBytes: quota - totalBytes,
        usedPercent:   ((totalBytes / quota) * 100).toFixed(1),
      } : null,
      compressionStats: agg.compressionStats,
      videoCompressionStats: agg.videoCompressionStats,
    });
  } catch (err) { next(err); }
});

/* ─── Storage & Capacity: history (for the over-time chart) ───── */

router.get('/storage/history', requireFullAdminRole, async (req, res, next) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  try {
    const { rows } = await query(
      `SELECT snapshot_date AS date, total_bytes, docs_bytes, images_bytes, user_count
         FROM storage_snapshots
        WHERE snapshot_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        ORDER BY snapshot_date`,
      [days],
    );
    res.json({
      days,
      snapshots: rows.map((r) => ({
        date: r.date,
        totalBytes: Number(r.total_bytes),
        docsBytes: Number(r.docs_bytes),
        imagesBytes: Number(r.images_bytes),
        userCount: r.user_count,
      })),
    });
  } catch (err) { next(err); }
});

/* ─── Contact submissions ────────────────────────────────────── */

router.get('/contact-submissions', requireFullAdminRole, async (req, res, next) => {
  const page      = Math.max(parseInt(req.query.page,  10) || 1,   1);
  const limit     = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset    = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  try {
    const [listRes, countRes] = await Promise.all([
      query(
        `SELECT id, name, email, subject, country, message, read_at, created_at
           FROM contact_submissions
          WHERE ($1 = false OR read_at IS NULL)
          ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [unreadOnly, limit, offset],
      ),
      query(
        'SELECT COUNT(*)::int AS total FROM contact_submissions WHERE ($1 = false OR read_at IS NULL)',
        [unreadOnly],
      ),
    ]);
    res.json({ submissions: listRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (err) { next(err); }
});

router.patch('/contact-submissions/:id/read', requireFullAdminRole, async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE contact_submissions SET read_at = NOW() WHERE id = $1 AND read_at IS NULL RETURNING id, read_at',
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or already read' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/* ─── Blog image upload ──────────────────────────────────────── */

router.post('/blogs/upload-image',
  blogImageUpload.single('image'),
  handleMulterError,
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    try {
      const safeName = sanitiseFilename(req.file.originalname);
      const key = `blog-images/${uuidv4()}-${safeName}`;
      await uploadToS3(req.file.buffer, key, req.file.mimetype);
      const url = config.s3.cloudfrontDomain
        ? `https://${config.s3.cloudfrontDomain}/${key}`
        : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
      res.json({ url });
    } catch (err) { next(err); }
  },
);

/* ─── Blogs CRUD ─────────────────────────────────────────────── */

router.get('/blogs', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM blogs ORDER BY sort_order_web NULLS LAST, published_at DESC');
    res.json(rows.map(mapBlog));
  } catch (err) { next(err); }
});

router.post('/blogs', async (req, res, next) => {
  const { slug, image, title, excerpt, content, category, author,
          publishedAt, published = true, showOnWeb = true, showOnApp = true,
          sortOrderWeb, sortOrderApp } = req.body;
  if (!slug || !image || !title || !excerpt || !content || !category || !publishedAt) {
    return res.status(400).json({ error: 'slug, image, title, excerpt, content, category, publishedAt are required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO blogs (slug, image, title, excerpt, content, category, author,
         published_at, published, show_on_web, show_on_app, sort_order_web, sort_order_app)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [slug, image, title, excerpt, content, category, author || 'Vihaan Khanna',
       publishedAt, published, showOnWeb, showOnApp, sortOrderWeb ?? null, sortOrderApp ?? null],
    );
    res.status(201).json(mapBlog(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    next(err);
  }
});

router.patch('/blogs/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const colMap = { slug: 'slug', image: 'image', title: 'title', excerpt: 'excerpt',
    content: 'content', category: 'category', author: 'author',
    publishedAt: 'published_at', published: 'published',
    showOnWeb: 'show_on_web', showOnApp: 'show_on_app',
    sortOrderWeb: 'sort_order_web', sortOrderApp: 'sort_order_app' };
  const sets = []; const vals = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in req.body) { vals.push(req.body[key]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided' });
  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE blogs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Blog not found' });
    res.json(mapBlog(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    next(err);
  }
});

router.delete('/blogs/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM blogs WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Blog not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ─── Promo Video ────────────────────────────────────────────── */

router.get('/promo-video', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, video_url, s3_key, created_at, updated_at FROM promo_video WHERE id = 1');
    if (!rows.length) return res.json(null);
    const row = rows[0];
    if (config.s3.cloudfrontDomain && row.video_url.includes('.amazonaws.com/') && row.s3_key) {
      row.video_url = `https://${config.s3.cloudfrontDomain}/${row.s3_key}`;
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/promo-video/upload',
  promoVideoUpload.single('video'),
  handleMulterError,
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No video file provided' });
    try {
      const safeName = sanitiseFilename(req.file.originalname);
      const key = `promo-video/${uuidv4()}-${safeName}`;

      // Upload to S3 with long-lived cache headers
      await uploadToS3(req.file.buffer, key, req.file.mimetype, {
        CacheControl: 'public, max-age=31536000',
      });

      const url = config.s3.cloudfrontDomain
        ? `https://${config.s3.cloudfrontDomain}/${key}`
        : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

      // Fetch old key before upsert so we can delete it from S3
      const { rows: existing } = await query('SELECT s3_key FROM promo_video WHERE id = 1');
      const oldKey = existing[0]?.s3_key ?? null;

      await query(
        `INSERT INTO promo_video (id, video_url, s3_key)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET video_url = $1, s3_key = $2, updated_at = NOW()`,
        [url, key],
      );

      // Delete old S3 object after successful DB write
      if (oldKey && oldKey !== key) {
        deleteFromS3(oldKey).catch((e) => logger.warn('Failed to delete old promo video from S3', { key: oldKey, error: e.message }));
      }

      // Fire-and-forget: promo_video has no size column to update, so this
      // just swaps in a smaller S3 object in place once transcoding finishes.
      compressAndReplaceVideoAsync({ buffer: req.file.buffer, s3Key: key, mimeType: req.file.mimetype })
        .catch((e) => logger.warn('Promo video compression kickoff failed', { key, error: e.message }));

      res.json({ videoUrl: url });
    } catch (err) { next(err); }
  },
);

router.delete('/promo-video', async (_req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM promo_video WHERE id = 1 RETURNING s3_key');
    if (!rows.length) return res.status(404).json({ error: 'No promo video set' });
    deleteFromS3(rows[0].s3_key).catch((e) => logger.warn('Failed to delete promo video from S3', { key: rows[0].s3_key, error: e.message }));
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ─── Deals CRUD ─────────────────────────────────────────────── */

function mapDeal(row) {
  return {
    id: row.id, title: row.title, subtitle: row.subtitle ?? null,
    imageUrl: row.image_url, hyperlink: row.hyperlink ?? null,
    sortOrder: row.sort_order ?? null, active: row.active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

router.post('/deals/upload-image',
  dealImageUpload.single('image'),
  handleMulterError,
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    try {
      const safeName = sanitiseFilename(req.file.originalname);
      const key = `deal-images/${uuidv4()}-${safeName}`;
      await uploadToS3(req.file.buffer, key, req.file.mimetype);
      const url = config.s3.cloudfrontDomain
        ? `https://${config.s3.cloudfrontDomain}/${key}`
        : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
      res.json({ url });
    } catch (err) { next(err); }
  },
);

router.get('/deals', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM deals ORDER BY sort_order NULLS LAST, created_at DESC');
    res.json(rows.map(mapDeal));
  } catch (err) { next(err); }
});

router.post('/deals', async (req, res, next) => {
  const { title, subtitle, imageUrl, hyperlink, sortOrder, active = true } = req.body;
  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'title and imageUrl are required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO deals (title, subtitle, image_url, hyperlink, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, subtitle ?? null, imageUrl, hyperlink ?? null, sortOrder ?? null, active],
    );
    res.status(201).json(mapDeal(rows[0]));
  } catch (err) { next(err); }
});

router.patch('/deals/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const colMap = {
    title: 'title', subtitle: 'subtitle', imageUrl: 'image_url',
    hyperlink: 'hyperlink', sortOrder: 'sort_order', active: 'active',
  };
  const sets = []; const vals = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in req.body) { vals.push(req.body[key]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided' });
  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE deals SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' });
    res.json(mapDeal(rows[0]));
  } catch (err) { next(err); }
});

router.delete('/deals/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM deals WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Deal not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ─── Legal documents (privacy / terms) ─────────────────────── */

router.get('/legal/versions', requireFullAdminRole, async (req, res, next) => {
  const documentType = req.query.documentType;
  if (!['privacy', 'terms'].includes(documentType)) {
    return res.status(400).json({ error: 'documentType must be privacy or terms' });
  }
  try {
    const versions = await legalService.listVersions(documentType);
    const suggestedNext = await legalService.getSuggestedNextVersion(documentType);
    const current = await legalService.getCurrentPublished(documentType);
    res.json({ versions, suggestedNext, current });
  } catch (err) { next(err); }
});

router.post('/legal/publish', requireFullAdminRole, async (req, res, next) => {
  try {
    const doc = await legalService.publishVersion(req.body);
    res.status(201).json(doc);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.error || 'BadRequest', message: err.message });
    }
    next(err);
  }
});

/* ─── AI (Swee) usage ─────────────────────────────────────────── */

router.get('/ai-usage', requireFullAdminRole, async (_req, res) => {
  let metrics = null;
  try { metrics = require('../ai/swee.metrics').getSnapshot(); } catch { /* ai module unavailable */ }

  let circuit = null;
  try { circuit = require('../ai/swee.circuitBreaker').getStatus(); } catch { /* ai module unavailable */ }

  let conversationsTotal = null;
  try {
    const { rows } = await query(`SELECT COUNT(*)::int AS total FROM feedback WHERE type = 'swee_report'`);
    conversationsTotal = Number(rows[0].total);
  } catch { /* feedback table not reachable */ }

  let summary = null;
  try { summary = await require('../ai/aiUsage.service').getSummary(); } catch { /* ai_usage_events table not reachable */ }

  res.json({
    metrics,
    circuit,
    summary,
    rateLimits: {
      perUserPerHour: config.rateLimits.sweeChatPerHour,
      perUserPerDay: config.rateLimits.sweeChatPerDay,
    },
    sweeReportsTotal: conversationsTotal,
    note: 'Requests (window) is a rolling 15-min counter that resets on redeploy — use the summary/history above for real historical trends.',
  });
});

/* ─── AI (Swee) usage: day-bucketed history for the trend chart ── */

router.get('/ai-usage/history', requireFullAdminRole, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 400;
    const history = await require('../ai/aiUsage.service').getDailyHistory(days);
    res.json({ history });
  } catch (err) { next(err); }
});

module.exports = router;
