const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { GetSendQuotaCommand } = require('@aws-sdk/client-ses');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { GoogleAuth } = require('google-auth-library');
const authenticateJWT = require('../../middleware/authenticate');
const { requirePlatformAdmin, getCount30m } = require('./admin.middleware');
const { blogImageUpload, dealImageUpload, handleMulterError } = require('../../middleware/upload.middleware');
const { query } = require('../../config/database');
const { sesClient, s3Client } = require('../../config/aws');
const { uploadToS3, sanitiseFilename } = require('../../utils/s3.util');
const config = require('../../config');
const logger = require('../../utils/logger');
const legalService = require('../legal/legal.service');

const router = express.Router();
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

router.use(authenticateJWT, requirePlatformAdmin);

/* ─── Helpers ────────────────────────────────────────────────── */

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
  try {
    const { rows } = await query(`
      SELECT
        -- Registered users (exclude platform admins from count)
        (SELECT COUNT(*) FROM users WHERE is_platform_admin = false)                     AS registered_users,
        -- Active users: logged in within last 30 days (non-admin)
        (SELECT COUNT(*) FROM users
          WHERE is_platform_admin = false
            AND last_login_at >= NOW() - INTERVAL '30 days')                             AS active_users,

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
    `);

    const r = rows[0];
    res.json({
      users: {
        registered: Number(r.registered_users),
        active: Number(r.active_users),
        activeDefinition: 'Signed in within the last 30 days (admins excluded)',
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
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
  try {
    const [usersRes, tripsRes, eventsRes] = await Promise.all([
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM users WHERE is_platform_admin = false
             AND created_at >= NOW() - ($1 || ' days')::INTERVAL
           GROUP BY 1 ORDER BY 1`, [days],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM trips WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
           GROUP BY 1 ORDER BY 1`, [days],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM events WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
           GROUP BY 1 ORDER BY 1`, [days],
      ),
    ]);
    res.json({ days, users: usersRes.rows, trips: tripsRes.rows, events: eventsRes.rows });
  } catch (err) { next(err); }
});

/* ─── Users list ─────────────────────────────────────────────── */

router.get('/users', async (req, res, next) => {
  const page  = Math.max(parseInt(req.query.page,  10) || 1,   1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    const [listRes, countRes] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.is_verified, u.is_profile_complete,
                u.is_platform_admin, u.created_at, u.last_login_at,
                p.full_name
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE u.is_platform_admin = false
            AND ($1::text IS NULL OR u.email ILIKE $1 OR p.full_name ILIKE $1)
          ORDER BY u.last_login_at DESC NULLS LAST
          LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE u.is_platform_admin = false
            AND ($1::text IS NULL OR u.email ILIKE $1 OR p.full_name ILIKE $1)`,
        [search],
      ),
    ]);
    res.json({ users: listRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (err) { next(err); }
});

/* ─── Users: update ──────────────────────────────────────────── */

router.patch('/users/:id', async (req, res, next) => {
  const { id } = req.params;
  const { is_platform_admin } = req.body;
  if (typeof is_platform_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_platform_admin must be boolean' });
  }
  try {
    if (!is_platform_admin) {
      const { rows } = await query(
        'SELECT COUNT(*)::int AS cnt FROM users WHERE is_platform_admin = true AND id != $1',
        [id],
      );
      if (rows[0].cnt === 0) return res.status(400).json({ error: 'Cannot remove the last platform admin' });
    }
    const { rows } = await query(
      'UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_platform_admin',
      [is_platform_admin, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/* ─── Trips & Events detail ──────────────────────────────────── */

router.get('/trips-events', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        -- Trips
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND start_date > NOW())    AS trips_upcoming,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL
          AND start_date <= NOW() AND end_date >= NOW())                                 AS trips_active,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NULL AND end_date < NOW())      AS trips_completed,
        (SELECT COUNT(*) FROM trips WHERE archived_at IS NOT NULL)                       AS trips_archived,
        (SELECT COUNT(*) FROM trips)                                                     AS trips_total,

        -- Events
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date > CURRENT_DATE)   AS events_upcoming,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL
          AND event_date = CURRENT_DATE)                                                         AS events_active,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND event_date < CURRENT_DATE)    AS events_completed,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NOT NULL)                              AS events_archived,
        (SELECT COUNT(*) FROM events)                                                    AS events_total,

        -- Shared activity
        (SELECT COUNT(*) FROM expenses)                                                  AS total_expenses,
        (SELECT COUNT(*) FROM photos)                                                    AS total_photos,
        (SELECT COUNT(*) FROM docs)                                                      AS total_docs,
        (SELECT COUNT(*) FROM notes)                                                     AS total_notes
    `);
    const r = rows[0];
    res.json({
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

router.get('/health', async (_req, res) => {
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
    gemini: cfg.gemini.apiKey                  ? 'configured' : 'not_configured',
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

  // SES — GetSendQuota is read-only, sends nothing
  try {
    await sesClient.send(new GetSendQuotaCommand({}));
    result.email = 'ok';
  } catch (e) {
    result.email = (e.name === 'CredentialsProviderError' || e.Code === 'AuthFailure')
      ? 'not_configured' : 'error';
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

/* ─── Storage & Capacity ─────────────────────────────────────── */

router.get('/storage', async (req, res, next) => {
  try {
    const [docsRes, photosRes, usersRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int                          AS total_count,
          COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes,
          mime_type,
          COUNT(*)::int                          AS type_count,
          COALESCE(SUM(file_size_bytes), 0)::bigint AS type_bytes
        FROM docs
        GROUP BY ROLLUP (mime_type)
        ORDER BY total_bytes DESC NULLS LAST`),
      query(`
        SELECT
          COUNT(*)::int                          AS total_count,
          COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes,
          mime_type,
          COUNT(*)::int                          AS type_count,
          COALESCE(SUM(file_size_bytes), 0)::bigint AS type_bytes
        FROM photos
        GROUP BY ROLLUP (mime_type)
        ORDER BY type_bytes DESC NULLS LAST`),
      query('SELECT COUNT(*)::int AS user_count FROM users WHERE is_platform_admin = false'),
    ]);

    // ROLLUP produces a NULL-mime_type row as the grand total
    const docsTotal  = docsRes.rows.find((r) => r.mime_type === null) || { total_count: 0, total_bytes: 0 };
    const photosTotal = photosRes.rows.find((r) => r.mime_type === null) || { total_count: 0, total_bytes: 0 };
    const docsBreakdown   = docsRes.rows.filter((r) => r.mime_type !== null);
    const photosBreakdown = photosRes.rows.filter((r) => r.mime_type !== null);

    const totalBytes = Number(docsTotal.total_bytes) + Number(photosTotal.total_bytes);
    const userCount  = usersRes.rows[0].user_count || 1;
    const quota      = parseInt(process.env.STORAGE_QUOTA_BYTES, 10) || 0;

    res.json({
      summary: {
        totalBytes,
        totalMB:  (totalBytes / 1024 / 1024).toFixed(2),
        totalGB:  (totalBytes / 1024 / 1024 / 1024).toFixed(3),
      },
      docs: {
        count:      Number(docsTotal.total_count),
        totalBytes: Number(docsTotal.total_bytes),
        totalMB:    (Number(docsTotal.total_bytes) / 1024 / 1024).toFixed(2),
        breakdown:  docsBreakdown.map((r) => ({
          mimeType:  r.mime_type,
          count:     Number(r.type_count),
          bytes:     Number(r.type_bytes),
          mb:        (Number(r.type_bytes) / 1024 / 1024).toFixed(2),
        })),
      },
      images: {
        count:      Number(photosTotal.total_count),
        totalBytes: Number(photosTotal.total_bytes),
        totalMB:    (Number(photosTotal.total_bytes) / 1024 / 1024).toFixed(2),
        breakdown:  photosBreakdown.map((r) => ({
          mimeType:  r.mime_type,
          count:     Number(r.type_count),
          bytes:     Number(r.type_bytes),
          mb:        (Number(r.type_bytes) / 1024 / 1024).toFixed(2),
        })),
        note: 'Byte totals only cover uploads after migration 030; earlier rows have NULL size.',
      },
      users: userCount,
      averageBytesPerUser:  userCount ? Math.round(totalBytes / userCount) : 0,
      averageMBPerUser:     userCount ? (totalBytes / 1024 / 1024 / userCount).toFixed(2) : '0.00',
      quota: quota ? {
        totalBytes:    quota,
        totalGB:       (quota / 1024 / 1024 / 1024).toFixed(2),
        usedBytes:     totalBytes,
        availableBytes: quota - totalBytes,
        usedPercent:   ((totalBytes / quota) * 100).toFixed(1),
      } : null,
    });
  } catch (err) { next(err); }
});

/* ─── Contact submissions ────────────────────────────────────── */

router.get('/contact-submissions', async (req, res, next) => {
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

router.patch('/contact-submissions/:id/read', async (req, res, next) => {
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

router.get('/legal/versions', async (req, res, next) => {
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

router.post('/legal/publish', async (req, res, next) => {
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

module.exports = router;
