const { query } = require('../../config/database');

/**
 * Aggregate storage totals across docs/photos + registered user count.
 * Shared by GET /admin/storage (live view) and the daily snapshot cron.
 */
async function getStorageAggregates() {
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
  const docsTotal   = docsRes.rows.find((r) => r.mime_type === null) || { total_count: 0, total_bytes: 0 };
  const photosTotal = photosRes.rows.find((r) => r.mime_type === null) || { total_count: 0, total_bytes: 0 };
  const docsBreakdown   = docsRes.rows.filter((r) => r.mime_type !== null);
  const photosBreakdown = photosRes.rows.filter((r) => r.mime_type !== null);

  const docsBytes   = Number(docsTotal.total_bytes);
  const imagesBytes = Number(photosTotal.total_bytes);

  return {
    totalBytes: docsBytes + imagesBytes,
    docsBytes,
    docsCount: Number(docsTotal.total_count),
    docsBreakdown,
    imagesBytes,
    imagesCount: Number(photosTotal.total_count),
    imagesBreakdown: photosBreakdown,
    userCount: usersRes.rows[0].user_count || 0,
  };
}

/** Upserts today's snapshot row. Idempotent — safe to call more than once a day. */
async function snapshotStorageToday() {
  const agg = await getStorageAggregates();
  await query(
    `INSERT INTO storage_snapshots
       (snapshot_date, total_bytes, docs_bytes, docs_count, images_bytes, images_count, user_count)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6)
     ON CONFLICT (snapshot_date) DO UPDATE SET
       total_bytes = EXCLUDED.total_bytes, docs_bytes = EXCLUDED.docs_bytes, docs_count = EXCLUDED.docs_count,
       images_bytes = EXCLUDED.images_bytes, images_count = EXCLUDED.images_count, user_count = EXCLUDED.user_count`,
    [agg.totalBytes, agg.docsBytes, agg.docsCount, agg.imagesBytes, agg.imagesCount, agg.userCount],
  );
  return agg;
}

module.exports = { getStorageAggregates, snapshotStorageToday };
