const express = require('express');
const authenticateJWT = require('../../middleware/authenticate');
const { requirePlatformAdmin, getCount30m } = require('./admin.middleware');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const router = express.Router();

// All admin routes require a valid JWT + platform admin flag
router.use(authenticateJWT, requirePlatformAdmin);

/* ── Helpers ─────────────────────────────────────────────────── */

function mapBlog(row) {
  return {
    id: row.id,
    slug: row.slug,
    image: row.image,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    author: row.author,
    publishedAt: row.published_at,
    published: row.published,
    showOnWeb: row.show_on_web,
    showOnApp: row.show_on_app,
    sortOrderWeb: row.sort_order_web,
    sortOrderApp: row.sort_order_app,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ── Dashboard: summary ──────────────────────────────────────── */

router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                                           AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_profile_complete = true OR created_at >= NOW() - INTERVAL '30 days') AS active_users,
        (SELECT COUNT(*) FROM trips  WHERE archived_at IS NULL AND start_date  > NOW())       AS trips_upcoming,
        (SELECT COUNT(*) FROM trips  WHERE archived_at IS NULL AND start_date <= NOW() AND end_date >= NOW()) AS trips_active,
        (SELECT COUNT(*) FROM trips  WHERE archived_at IS NULL AND end_date    < NOW())       AS trips_completed,
        (SELECT COUNT(*) FROM trips  WHERE archived_at IS NOT NULL)                           AS trips_archived,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND start_date  > NOW())       AS events_upcoming,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND start_date <= NOW() AND end_date >= NOW()) AS events_active,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NULL AND end_date    < NOW())       AS events_completed,
        (SELECT COUNT(*) FROM events WHERE archived_at IS NOT NULL)                           AS events_archived,
        (SELECT COUNT(*) FROM contact_submissions)                                            AS contact_total,
        (SELECT COUNT(*) FROM contact_submissions WHERE read_at IS NULL)                      AS contact_unread
    `);

    const r = rows[0];
    res.json({
      users: {
        total: Number(r.total_users),
        active: Number(r.active_users),
        activeDefinition: 'profile_complete=true OR registered in last 30 days',
      },
      trips: {
        upcoming: Number(r.trips_upcoming),
        active: Number(r.trips_active),
        completed: Number(r.trips_completed),
        archived: Number(r.trips_archived),
      },
      events: {
        upcoming: Number(r.events_upcoming),
        active: Number(r.events_active),
        completed: Number(r.events_completed),
        archived: Number(r.events_archived),
      },
      contact: {
        total: Number(r.contact_total),
        unread: Number(r.contact_unread),
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ── Dashboard: growth time-series ──────────────────────────── */

router.get('/dashboard/growth', async (req, res, next) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
  try {
    const [usersRes, tripsRes, eventsRes] = await Promise.all([
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM users
          WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
          GROUP BY 1 ORDER BY 1`,
        [days],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM trips
          WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
          GROUP BY 1 ORDER BY 1`,
        [days],
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS count
           FROM events
          WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
          GROUP BY 1 ORDER BY 1`,
        [days],
      ),
    ]);

    res.json({
      days,
      users: usersRes.rows,
      trips: tripsRes.rows,
      events: eventsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

/* ── Users list ──────────────────────────────────────────────── */

router.get('/users', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    const [listRes, countRes] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.is_verified, u.is_profile_complete,
                u.is_platform_admin, u.created_at,
                p.full_name
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE ($1::text IS NULL
                 OR u.email ILIKE $1
                 OR p.full_name ILIKE $1)
          ORDER BY u.created_at DESC
          LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE ($1::text IS NULL
                 OR u.email ILIKE $1
                 OR p.full_name ILIKE $1)`,
        [search],
      ),
    ]);

    res.json({
      users: listRes.rows,
      total: countRes.rows[0].total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/* ── Users: update ───────────────────────────────────────────── */

router.patch('/users/:id', async (req, res, next) => {
  const { id } = req.params;
  const { is_platform_admin } = req.body;

  if (typeof is_platform_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_platform_admin must be boolean' });
  }

  try {
    if (!is_platform_admin) {
      // Guard: cannot demote the last platform admin
      const { rows } = await query(
        "SELECT COUNT(*)::int AS cnt FROM users WHERE is_platform_admin = true AND id != $1",
        [id],
      );
      if (rows[0].cnt === 0) {
        return res.status(400).json({ error: 'Cannot remove the last platform admin' });
      }
    }

    const { rows } = await query(
      `UPDATE users SET is_platform_admin = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, is_platform_admin`,
      [is_platform_admin, id],
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ── Operational health ──────────────────────────────────────── */

router.get('/health', async (req, res, next) => {
  const result = {
    api: 'ok',
    db: 'unknown',
    frontend: 'unknown',
    adminPanel: 'unknown',
    requests30m: getCount30m(),
    timestamp: new Date().toISOString(),
  };

  try {
    await query('SELECT 1');
    result.db = 'ok';
  } catch {
    result.db = 'error';
  }

  const timeout = 4000;
  const checkUrl = async (url) => {
    if (!url) return 'not_configured';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetch(url, { signal: ctrl.signal, method: 'HEAD' }).finally(() => clearTimeout(timer));
      return r.ok ? 'ok' : `http_${r.status}`;
    } catch {
      return 'error';
    }
  };

  [result.frontend, result.adminPanel] = await Promise.all([
    checkUrl(process.env.FRONTEND_URL),
    checkUrl(process.env.ADMIN_PANEL_URL),
  ]);

  res.json(result);
});

/* ── Storage aggregates ──────────────────────────────────────── */

router.get('/storage', async (req, res, next) => {
  try {
    const [docsRes, photosRes, usersRes] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS doc_count,
                COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes
           FROM docs`,
      ),
      query('SELECT COUNT(*)::int AS photo_count FROM photos'),
      query('SELECT COUNT(*)::int AS user_count FROM users'),
    ]);

    const consumed = Number(docsRes.rows[0].total_bytes);
    const quota = parseInt(process.env.STORAGE_QUOTA_BYTES, 10) || 0;
    const userCount = usersRes.rows[0].user_count || 1;

    res.json({
      docs: {
        count: docsRes.rows[0].doc_count,
        totalBytes: consumed,
        totalMB: (consumed / 1024 / 1024).toFixed(2),
      },
      photos: {
        count: photosRes.rows[0].photo_count,
        note: 'byte totals not available without file_size_bytes on photos',
      },
      users: userCount,
      averageBytesPerUser: userCount ? Math.round(consumed / userCount) : 0,
      quota: quota
        ? {
            totalBytes: quota,
            totalGB: (quota / 1024 / 1024 / 1024).toFixed(2),
            usedBytes: consumed,
            availableBytes: quota - consumed,
            usedPercent: ((consumed / quota) * 100).toFixed(1),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/* ── Contact submissions ─────────────────────────────────────── */

router.get('/contact-submissions', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  try {
    const [listRes, countRes] = await Promise.all([
      query(
        `SELECT id, name, email, subject, country, message, read_at, created_at
           FROM contact_submissions
          WHERE ($1 = false OR read_at IS NULL)
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
        [unreadOnly, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM contact_submissions
          WHERE ($1 = false OR read_at IS NULL)`,
        [unreadOnly],
      ),
    ]);

    res.json({
      submissions: listRes.rows,
      total: countRes.rows[0].total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/contact-submissions/:id/read', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE contact_submissions SET read_at = NOW()
        WHERE id = $1 AND read_at IS NULL
        RETURNING id, read_at`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or already read' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ── Blogs CRUD ──────────────────────────────────────────────── */

router.get('/blogs', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM blogs ORDER BY sort_order_web NULLS LAST, published_at DESC`,
    );
    res.json(rows.map(mapBlog));
  } catch (err) {
    next(err);
  }
});

router.post('/blogs', async (req, res, next) => {
  const {
    slug, image, title, excerpt, content, category, author,
    publishedAt, published = true,
    showOnWeb = true, showOnApp = true,
    sortOrderWeb, sortOrderApp,
  } = req.body;

  if (!slug || !image || !title || !excerpt || !content || !category || !publishedAt) {
    return res.status(400).json({ error: 'slug, image, title, excerpt, content, category, publishedAt are required' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO blogs
         (slug, image, title, excerpt, content, category, author,
          published_at, published, show_on_web, show_on_app, sort_order_web, sort_order_app)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        slug, image, title, excerpt, content, category,
        author || 'Vihaan Khanna', publishedAt, published,
        showOnWeb, showOnApp, sortOrderWeb ?? null, sortOrderApp ?? null,
      ],
    );
    res.status(201).json(mapBlog(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    next(err);
  }
});

router.patch('/blogs/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const fields = req.body;
  const colMap = {
    slug: 'slug', image: 'image', title: 'title', excerpt: 'excerpt',
    content: 'content', category: 'category', author: 'author',
    publishedAt: 'published_at', published: 'published',
    showOnWeb: 'show_on_web', showOnApp: 'show_on_app',
    sortOrderWeb: 'sort_order_web', sortOrderApp: 'sort_order_app',
  };

  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided' });

  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE blogs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
      vals,
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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
