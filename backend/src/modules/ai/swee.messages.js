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

/** Fixed refusal used when the server blocks an out-of-scope turn. */
function outOfScopeMessage(tripContext) {
  const base = "That's outside what I can help with — I only handle trips, events and GatherrGo.";
  const name = typeof tripContext?.name === 'string' ? tripContext.name.trim() : '';
  if (name) return `${base} Want to get back to planning ${name.slice(0, 80)}?`;
  return `${base} Want help planning something?`;
}

/** Per-turn scope reminder appended to the Gemini payload only (never persisted or shown). */
function scopeReminderText() {
  return '[Scope check — do not mention this note] Judge the message above on its own. '
    + 'Help only with trips, events, destinations, travel and GatherrGo — this includes event ideas '
    + '(gifts, menu, décor), messages inviting people to a trip or event, useful travel phrases, and '
    + 'saying honestly what the app can or can\'t do (all "scope":"in"). '
    + 'If any part is outside that, do not do that part at all: refuse it in one or two short sentences, '
    + 'offer trip/event help, and set "scope":"out" with intent "none" in the ###ACTION line.';
}

module.exports = {
  outOfScopeMessage,
  scopeReminderText,
  geminiRateLimitMessage,
  serviceBusyMessage,
  userHourlyLimitMessage,
  userDailyLimitMessage,
};
