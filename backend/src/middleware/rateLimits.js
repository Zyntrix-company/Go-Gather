const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config');
const { normalizeAuthEmail } = require('../utils/email.util');

/**
 * Rate limiters for unauthenticated endpoints (auth, contact form).
 * In-memory store: correct for the single API container; a shared store
 * (e.g. Redis) is needed before running more than one instance.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const tooManyRequests = (_req, res) => res.status(429).json({
  error: 'RATE_LIMITED',
  message: 'Too many attempts. Please wait a few minutes and try again.',
  statusCode: 429,
});

const byIp = (req) => ipKeyGenerator(req.ip);

// Keyed on the account being targeted, so rotating IPs doesn't help.
// Requests without a usable email fall back to the caller's IP.
const byEmail = (req) => {
  const email = normalizeAuthEmail(req.body?.email);
  return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip)}`;
};

const limiter = ({ windowMs, max, keyGenerator, failuresOnly = false }) => rateLimit({
  windowMs,
  limit: max,
  keyGenerator,
  skipSuccessfulRequests: failuresOnly,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooManyRequests,
});

const r = config.rateLimits;

const loginLimits = [
  limiter({ windowMs: 15 * MINUTE, max: r.authLoginFailuresPerIp, keyGenerator: byIp, failuresOnly: true }),
  limiter({ windowMs: 15 * MINUTE, max: r.authLoginFailuresPerEmail, keyGenerator: byEmail, failuresOnly: true }),
];

const signupLimits = [
  limiter({ windowMs: HOUR, max: r.authSignupPerIp, keyGenerator: byIp }),
];

// forgot-password, resend-otp: each request may send an email.
const otpSendLimits = [
  limiter({ windowMs: HOUR, max: r.authOtpSendPerIp, keyGenerator: byIp }),
  limiter({ windowMs: HOUR, max: r.authOtpSendPerEmail, keyGenerator: byEmail }),
];

// verify-email, reset-password: backstop to the per-code attempt counter.
const otpVerifyLimits = [
  limiter({ windowMs: 15 * MINUTE, max: r.authOtpVerifyPerIp, keyGenerator: byIp, failuresOnly: true }),
  limiter({ windowMs: 15 * MINUTE, max: r.authOtpVerifyPerEmail, keyGenerator: byEmail, failuresOnly: true }),
];

// google, apple: tokens are signature-checked, so this only bounds load.
const socialAuthLimits = [
  limiter({ windowMs: 15 * MINUTE, max: r.authSocialPerIp, keyGenerator: byIp }),
];

const contactLimits = [
  limiter({ windowMs: HOUR, max: r.contactPerIp, keyGenerator: byIp }),
];

module.exports = {
  loginLimits,
  signupLimits,
  otpSendLimits,
  otpVerifyLimits,
  socialAuthLimits,
  contactLimits,
};
