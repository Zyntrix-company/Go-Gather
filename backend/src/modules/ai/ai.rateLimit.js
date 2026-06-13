const rateLimit = require('express-rate-limit');
const config = require('../../config');
const { userHourlyLimitMessage, userDailyLimitMessage } = require('./swee.messages');

function getRetryMinutes(req) {
  const resetTime = req.rateLimit?.resetTime;
  if (!resetTime) return null;
  return Math.max(1, Math.ceil((resetTime - Date.now()) / 60_000));
}

function hourlyLimitHandler(req, res) {
  const retryAfterMinutes = getRetryMinutes(req);
  res.status(429).json({
    error: 'UserHourlyLimit',
    limitType: 'hourly',
    message: userHourlyLimitMessage(retryAfterMinutes),
    retryAfterMinutes,
  });
}

function dailyLimitHandler(req, res) {
  const retryAfterMinutes = getRetryMinutes(req);
  res.status(429).json({
    error: 'UserDailyLimit',
    limitType: 'daily',
    message: userDailyLimitMessage(config.rateLimits.sweeChatPerDay),
    retryAfterMinutes,
  });
}

const sweeChatHourlyLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimits.sweeChatPerHour,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: hourlyLimitHandler,
});

const sweeChatDailyLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: config.rateLimits.sweeChatPerDay,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: dailyLimitHandler,
});

module.exports = {
  sweeChatHourlyLimit,
  sweeChatDailyLimit,
};
