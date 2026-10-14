/**
 * Generates the share text that the mobile app passes to React Native's Share.share().
 *
 * Dev  (APP_IS_LIVE=false) → adds early-access note
 * Prod (APP_IS_LIVE=true)  → clean text, no note
 *
 * @param {object} opts
 * @param {string} opts.inviterName - Display name of the inviter
 * @param {string} opts.branchUrl   - Invite URL ({APP_DEEP_LINK_BASE_URL}/invite/{type}/{token})
 * @param {'friend'|'trip'|'event'} opts.type
 * @param {string} [opts.context]   - Trip/event name
 * @returns {string}
 */
const config = require('../config');

const generateInviteShareText = ({ inviterName, branchUrl, type, context }) => {
  const isLive = process.env.APP_IS_LIVE === 'true';
  const brand = config.brandName;

  const contextLines = {
    friend: `${inviterName} wants to connect with you on ${brand} — a group travel planning app!`,
    trip:   `${inviterName} is inviting you to join their trip "${context}" on ${brand}!`,
    event:  `${inviterName} is inviting you to "${context}" on ${brand}!`,
  };

  const devNote = isLive
    ? ''
    : `

Note: ${brand} is currently in early access. Tap the link for install instructions.`;

  return `${contextLines[type] || contextLines.friend}

Plan trips together, split expenses, and keep all your travel memories in one place.

Accept the invite:
${branchUrl}${devNote}`;
};

module.exports = { generateInviteShareText };
