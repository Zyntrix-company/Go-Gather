const crypto = require('crypto');
const { query: db } = require('../../config/database');
const config = require('../../config');

// ─── Reusable trip/event share links ──────────────────────────────────────────
//
// One link per (trip|event, member who shares it): get-or-create, never reset,
// never expires. The link is valid for as long as the parent exists and its
// creator is still a member (enforced in invites.service).

const buildShareUrl = (parentType, token) =>
  `${config.appDeepLinkBaseUrl}/invite/${parentType}/${token}`;

/**
 * Returns the sharer's link for this trip/event, creating it on first use.
 * The no-op DO UPDATE makes RETURNING hand back the existing row, so concurrent
 * first calls converge on one token.
 */
const getOrCreateShareLink = async (parentType, parentId, userId) => {
  const result = await db(
    `INSERT INTO share_links (parent_type, parent_id, created_by, token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (parent_type, parent_id, created_by)
     DO UPDATE SET created_by = share_links.created_by
     RETURNING token`,
    [parentType, parentId, userId, crypto.randomUUID()],
  );
  const token = result.rows[0].token;
  return { token, url: buildShareUrl(parentType, token) };
};

/** Looks a share link up by token, with the sharer's profile. Null if unknown. */
const findShareLinkByToken = async (token) => {
  const result = await db(
    `SELECT sl.id, sl.parent_type, sl.parent_id, sl.created_by AS invited_by,
            p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
     FROM share_links sl
     LEFT JOIN profiles p ON p.user_id = sl.created_by
     WHERE sl.token = $1`,
    [token],
  );
  return result.rows[0] || null;
};

module.exports = { buildShareUrl, getOrCreateShareLink, findShareLinkByToken };
