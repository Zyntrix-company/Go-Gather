#!/usr/bin/env node
/**
 * Brevo email delivery diagnostic script.
 *
 * Usage (from backend/):
 *   node scripts/test-brevo-email.js you@gmail.com
 *   TEST_EMAIL=you@gmail.com node scripts/test-brevo-email.js
 *
 * Optional flags:
 *   --otp-only     Send only the real OTP template (default)
 *   --plain-only   Send only a minimal plain test email
 *   --both         Send plain test + OTP template
 *   --skip-send    Check Brevo config/senders only, do not send
 *
 * Requires BREVO_API_KEY, BREVO_FROM_EMAIL in backend/.env
 */
'use strict';

const path = require('path');
const axios = require('axios');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config');
const { EMAIL_PROVIDER } = require('../src/config/emailProvider');
const { sendVerificationOTPEmail, sendEmail } = require('../src/utils/mailer');

const BREVO_BASE = 'https://api.brevo.com/v3';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

const toEmail = args[0] || process.env.TEST_EMAIL;
const sendOtp = flags.has('--both') || flags.has('--otp-only') || (!flags.has('--plain-only') && !flags.has('--skip-send'));
const sendPlain = flags.has('--both') || flags.has('--plain-only');
const skipSend = flags.has('--skip-send');

// ─── Console helpers ─────────────────────────────────────────────────────────

const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const fail = (s) => console.log(`  \x1b[31m✗\x1b[0m ${s}`);
const warn = (s) => console.log(`  \x1b[33m!\x1b[0m ${s}`);
const section = (title) => console.log(`\n\x1b[36m━━ ${title}\x1b[0m`);

function maskKey(key) {
  if (!key || key.length < 12) return '(missing or too short)';
  return `${key.slice(0, 8)}…${key.slice(-4)} (${key.length} chars)`;
}

function brevoClient() {
  const { apiKey } = config.brevo;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set in backend/.env');
  if (apiKey.startsWith('xsmtpsib-')) {
    throw new Error('BREVO_API_KEY is an SMTP key (xsmtpsib-). Use a v3 API key (xkeysib-).');
  }
  return axios.create({
    baseURL: BREVO_BASE,
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    validateStatus: () => true,
  });
}

async function brevoGet(client, url, label) {
  const res = await client.get(url);
  if (res.status >= 400) {
    throw new Error(`${label} failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkConfig() {
  section('1. Local config');
  const { apiKey, fromEmail, fromName } = config.brevo;

  console.log(`  EMAIL_PROVIDER     : ${EMAIL_PROVIDER}`);
  console.log(`  BREVO_FROM_EMAIL   : ${fromEmail || '(missing)'}`);
  console.log(`  BREVO_FROM_NAME    : ${fromName || '(missing)'}`);
  console.log(`  BREVO_API_KEY      : ${maskKey(apiKey)}`);
  console.log(`  SUPPORT_EMAIL      : ${config.ses.supportEmail || '(unset)'}`);
  console.log(`  NODE_ENV           : ${config.nodeEnv}`);

  if (EMAIL_PROVIDER !== 'brevo') {
    warn(`emailProvider.js is set to "${EMAIL_PROVIDER}", not "brevo".`);
  }
  if (!fromEmail) throw new Error('BREVO_FROM_EMAIL is required');
  if (!apiKey) throw new Error('BREVO_API_KEY is required');

  if (fromEmail !== fromEmail.toLowerCase()) {
    warn(`BREVO_FROM_EMAIL has uppercase (${fromEmail}). Brevo senders are often lowercase — try hello@gatherrgo.com`);
  }

  ok('Config loaded');
}

async function checkBrevoAccount(client) {
  section('2. Brevo account');
  const account = await brevoGet(client, '/account', 'Account');
  console.log(`  Company / plan     : ${account.companyName || '—'} / ${account.plan?.type || '—'}`);
  console.log(`  Relay enabled      : ${account.relay?.enabled ?? '—'}`);
  console.log(`  Credits (email)    : ${account.plan?.credits ?? '—'}`);
  ok('Brevo API key is valid');
  return account;
}

async function checkSenders(client) {
  section('3. Verified senders');
  const data = await brevoGet(client, '/senders', 'Senders');
  const senders = data.senders || [];

  if (senders.length === 0) {
    fail('No senders found in Brevo');
    return { matched: null, senders };
  }

  const from = (config.brevo.fromEmail || '').toLowerCase();
  let matched = null;

  for (const s of senders) {
    const active = s.active ? 'active' : 'INACTIVE';
    const line = `${s.email} (${active})`;
    if ((s.email || '').toLowerCase() === from) {
      matched = s;
      ok(line + '  ← BREVO_FROM_EMAIL');
    } else {
      console.log(`     ${line}`);
    }
  }

  if (!matched) {
    fail(`BREVO_FROM_EMAIL "${config.brevo.fromEmail}" is NOT in your Brevo senders list`);
    warn('Add/verify this exact sender in Brevo → Senders, Domains & Dedicated IPs → Senders');
  } else if (!matched.active) {
    fail(`Sender ${matched.email} exists but is INACTIVE`);
  } else {
    ok('Sender matches BREVO_FROM_EMAIL and is active');
  }

  return { matched, senders };
}

async function checkDomains(client) {
  section('4. Verified domains');
  const data = await brevoGet(client, '/senders/domains', 'Domains');
  const domains = data.domains || [];

  if (domains.length === 0) {
    warn('No domains returned (may still be OK if using single sender verification)');
    return domains;
  }

  const fromDomain = (config.brevo.fromEmail || '').split('@')[1]?.toLowerCase();

  for (const d of domains) {
    const verified = d.verified ? 'verified' : 'NOT verified';
    const line = `${d.domain_name} (${verified})`;
    if ((d.domain_name || '').toLowerCase() === fromDomain) {
      if (d.verified) ok(line + '  ← sender domain');
      else fail(line + '  ← sender domain NOT verified');
    } else {
      console.log(`     ${line}`);
    }
  }

  return domains;
}

async function sendTestEmails() {
  if (!toEmail) {
    throw new Error('Recipient required: node scripts/test-brevo-email.js you@gmail.com');
  }

  section('5. Send test email(s)');
  console.log(`  Recipient          : ${toEmail}`);
  const sent = [];

  if (sendPlain) {
    const testCode = String(Math.floor(100000 + Math.random() * 900000));
    const ts = new Date().toISOString();
    console.log('\n  Sending plain test email…');
    const data = await sendEmail({
      to: toEmail,
      subject: `Gatherrgo Brevo test — ${ts}`,
      html: `<p>This is a plain Brevo test from scripts/test-brevo-email.js at ${ts}.</p><p>Test code: <strong>${testCode}</strong></p>`,
      text: `Brevo test at ${ts}. Test code: ${testCode}`,
    });
    ok(`Plain test sent — messageId: ${data.messageId}`);
    sent.push({ type: 'plain', messageId: data.messageId, code: testCode });
  }

  if (sendOtp) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    console.log('\n  Sending OTP template (same as signup)…');
    const data = await sendVerificationOTPEmail(toEmail, otp);
    ok(`OTP template sent — messageId: ${data.messageId}`);
    console.log(`  OTP in this test   : ${otp}  (also check your inbox)`);
    sent.push({ type: 'otp', messageId: data.messageId, code: otp });
  }

  return sent;
}

async function fetchRecentEvents(client, email) {
  section('6. Recent Brevo delivery events (last 24h)');

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  const fmt = (d) => d.toISOString().slice(0, 10); // Brevo expects YYYY-MM-DD

  const res = await client.get('/smtp/statistics/events', {
    params: {
      email,
      limit: 20,
      startDate: fmt(start),
      endDate: fmt(end),
    },
  });

  if (res.status >= 400) {
    warn(`Could not fetch events (${res.status}): ${JSON.stringify(res.data)}`);
    return [];
  }

  const events = res.data?.events || [];
  if (events.length === 0) {
    warn(`No Brevo events found for ${email} in the last 24 hours.`);
    warn('Check Brevo → Transactional → Logs manually with the messageId above.');
    return events;
  }

  for (const e of events.slice(0, 10)) {
    const ts = e.date || e.ts_event || '—';
    const ev = e.event || '—';
    const sub = e.subject || '—';
    const from = e.from || '—';
    console.log(`     [${ts}] ${ev}  from=${from}  subject=${sub}`);
  }

  const hasDelivered = events.some((e) => e.event === 'delivered');
  const hasHardBounce = events.some((e) => e.event === 'hardBounce' || e.event === 'hard_bounce');
  const hasBlocked = events.some((e) => e.event === 'blocked' || e.event === 'error');

  if (hasDelivered) ok('At least one "delivered" event found');
  if (hasHardBounce) fail('Hard bounce detected — recipient or domain rejected the mail');
  if (hasBlocked) fail('Blocked/error event detected — check Brevo transactional logs');

  return events;
}

function printNextSteps(messageIds) {
  section('7. What to do next');

  console.log('  1. Open Brevo → Transactional → Email logs');
  console.log('  2. Search by messageId:');
  for (const m of messageIds) {
    console.log(`       - ${m.messageId}  (${m.type})`);
  }
  console.log('  3. In Gmail: check Primary, Promotions, Spam, and "All Mail"');
  console.log('  4. If Brevo shows "delivered" but Gmail is empty, Gmail is filtering silently');
  console.log('     → try a different recipient (Outlook/Yahoo) to isolate Gmail vs Brevo');
  console.log('  5. Ensure BREVO_FROM_EMAIL exactly matches an active verified sender');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n\x1b[1mGatherrgo — Brevo email diagnostic\x1b[0m');

  await checkConfig();
  const client = brevoClient();

  await checkBrevoAccount(client);
  await checkSenders(client);
  await checkDomains(client);

  let sent = [];
  if (!skipSend) {
    sent = await sendTestEmails();
    // Brief pause before polling events
    await new Promise((r) => setTimeout(r, 3000));
    if (toEmail) await fetchRecentEvents(client, toEmail);
    printNextSteps(sent);
  } else {
    warn('Skipped send (--skip-send). Run without flag to send a test email.');
  }

  section('Done');
  ok('Diagnostic complete');
}

main().catch((err) => {
  fail(err.message);
  if (err.response?.data) console.error('  API response:', JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
