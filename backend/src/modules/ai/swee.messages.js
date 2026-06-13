/**
 * User-facing Swee limit / availability messages (single source of truth).
 */

function geminiRateLimitMessage() {
  return 'Swee is handling many requests at once. Please wait about a minute and try again — this is a temporary AI limit.';
}

function serviceBusyMessage() {
  return 'Swee is temporarily unavailable due to high demand. Please try again in a couple of minutes.';
}

function userHourlyLimitMessage(retryAfterMinutes) {
  const mins = Math.max(1, retryAfterMinutes || 60);
  if (mins < 60) {
    return `You've reached Swee's hourly limit. Please wait about ${mins} minute${mins === 1 ? '' : 's'} before sending more messages.`;
  }
  const hours = Math.ceil(mins / 60);
  return `You've reached Swee's hourly limit. Please wait about ${hours} hour${hours === 1 ? '' : 's'} before sending more messages.`;
}

function userDailyLimitMessage(dailyMax) {
  const limit = dailyMax || 200;
  return `You've reached Swee's daily limit (${limit} messages per day). Come back tomorrow to continue chatting — your chat history will be saved.`;
}

module.exports = {
  geminiRateLimitMessage,
  serviceBusyMessage,
  userHourlyLimitMessage,
  userDailyLimitMessage,
};
