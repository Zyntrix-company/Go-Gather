/**
 * Persisted Swee chat usage log — feeds the admin AI Usage page's
 * day/week/month/quarter summaries and trend chart. Separate from
 * swee.metrics.js, which only tracks a 15-min in-memory rolling window
 * for the circuit breaker.
 */

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const GEMINI_RATE_LIMIT_CODE = 'GEMINI_RATE_LIMIT';
const MAX_HISTORY_DAYS = 730;

/** Fire-and-forget — never throws, so a logging hiccup can't break a chat request. */
async function logUsageEvent(success, errorCode = null) {
  try {
    await query(
      'INSERT INTO ai_usage_events (success, error_code) VALUES ($1, $2)',
      [success, errorCode || null],
    );
  } catch (err) {
    logger.warn('ai_usage_events insert failed (non-critical)', { error: err.message });
  }
}

/** Calendar-based (not rolling) counts: today, this week (Mon-start), this month, this quarter. */
async function getSummary() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('day', NOW()))                        AS today,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('week', NOW()))                       AS this_week,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('month', NOW()))                      AS this_month,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('quarter', NOW()))                    AS this_quarter,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('day', NOW())
          AND error_code = $1)                                               AS rate_limited_today,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('week', NOW())
          AND error_code = $1)                                               AS rate_limited_week,
      (SELECT COUNT(*)::int FROM ai_usage_events
        WHERE created_at >= date_trunc('month', NOW())
          AND error_code = $1)                                               AS rate_limited_month
  `, [GEMINI_RATE_LIMIT_CODE]);

  const r = rows[0];
  return {
    today: r.today,
    thisWeek: r.this_week,
    thisMonth: r.this_month,
    thisQuarter: r.this_quarter,
    geminiRateLimited: {
      today: r.rate_limited_today,
      thisWeek: r.rate_limited_week,
      thisMonth: r.rate_limited_month,
    },
  };
}

/** Day-bucketed series for the trend chart — the frontend re-buckets into week/month/quarter. */
async function getDailyHistory(days = 400) {
  const safeDays = Math.min(Math.max(parseInt(days, 10) || 400, 1), MAX_HISTORY_DAYS);
  const { rows } = await query(
    `SELECT date_trunc('day', created_at)::date AS date,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = false)::int AS failed,
            COUNT(*) FILTER (WHERE error_code = $2)::int AS gemini_rate_limited
       FROM ai_usage_events
      WHERE created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY 1
      ORDER BY 1`,
    [safeDays, GEMINI_RATE_LIMIT_CODE],
  );
  return rows.map((r) => ({
    date: r.date,
    total: r.total,
    failed: r.failed,
    geminiRateLimited: r.gemini_rate_limited,
  }));
}

module.exports = {
  logUsageEvent,
  getSummary,
  getDailyHistory,
};
