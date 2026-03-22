const logger = require('./logger');

/**
 * Creates a Branch.io smart link for an invite token.
 *
 * Dev  (APP_IS_LIVE=false) → fallback URLs point to APK + TestFlight
 * Prod (APP_IS_LIVE=true)  → fallback URLs point to Play Store + App Store
 *
 * The same function works in both environments — controlled by env vars only.
 * At launch, flip APP_IS_LIVE=true in the Branch dashboard env var — no code changes.
 *
 * @param {object} opts
 * @param {string} opts.token        - Invite token (UUID)
 * @param {string} opts.inviterName  - Display name of the user who created the invite
 * @param {string} [opts.context]    - Trip/event name (for trip/event invites)
 * @param {'friend'|'trip'|'event'} opts.type - Invite type
 * @returns {Promise<string>} Branch short URL
 */
const createInviteSmartLink = async ({ token, inviterName, context, type }) => {
  const isLive = process.env.APP_IS_LIVE === 'true';

  const androidFallback = isLive
    ? process.env.ANDROID_STORE_URL
    : process.env.ANDROID_APK_URL;

  const iosFallback = isLive
    ? process.env.IOS_STORE_URL
    : process.env.IOS_TESTFLIGHT_URL;

  const inviteUrl = `${process.env.APP_INVITE_BASE_URL}/${token}`;

  const ogDescriptions = {
    friend: `${inviterName} wants to connect with you on GatherGo`,
    trip:   `${inviterName} invited you to join "${context}" on GatherGo`,
    event:  `${inviterName} invited you to "${context}" on GatherGo`,
  };

  const payload = {
    branch_key: process.env.BRANCH_KEY,
    channel: 'invite',
    feature: `${type}_invite`,
    data: {
      $canonical_url:    inviteUrl,
      $deeplink_path:    `invite/${token}`,  // React Native reads this via Branch SDK
      $android_url:      androidFallback,
      $ios_url:          iosFallback,
      $og_title:         'Join me on GatherGo',
      $og_description:   ogDescriptions[type] || ogDescriptions.friend,
      $og_image_url:     process.env.OG_INVITE_IMAGE_URL,
      invite_token:      token,              // available to app via Branch SDK
      invite_type:       type,
    },
  };

  const response = await fetch('https://api2.branch.io/v1/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Branch API error', { status: response.status, body });
    throw new Error(`Branch API error: ${response.status}`);
  }

  const data = await response.json();
  return data.url;
};

module.exports = { createInviteSmartLink };
