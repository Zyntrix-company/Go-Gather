const axios = require('axios');
const config = require('../../../config');

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function thirtyDaysAgoEpoch() {
  return Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
}

function getHeader(msgData, name) {
  const headers = msgData.payload?.headers || [];
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function flattenParts(parts) {
  const result = [];
  for (const part of parts) {
    result.push(part);
    if (part.parts) result.push(...flattenParts(part.parts));
  }
  return result;
}

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     config.google.clientId,
    redirect_uri:  config.google.redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/gmail.readonly openid email',
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await axios.post(TOKEN_URL, new URLSearchParams({
    code,
    client_id:     config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri:  config.google.redirectUri,
    grant_type:    'authorization_code',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const data = res.data;
  // Fetch email address via the id_token or userinfo
  const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    email:        userRes.data.email,
  };
}

async function refreshAccessToken(plainRefreshToken) {
  const res = await axios.post(TOKEN_URL, new URLSearchParams({
    client_id:     config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: plainRefreshToken,
    grant_type:    'refresh_token',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const data = res.data;
  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1000),
  };
}

async function getAttachments(accessToken) {
  const query = `has:attachment after:${thirtyDaysAgoEpoch()} -in:trash`;
  const listRes = await axios.get(`${GMAIL_BASE}/messages`, {
    params:  { q: query, maxResults: 50 },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const messages = listRes.data.messages || [];
  if (!messages.length) return [];

  const attachments = [];
  for (const msg of messages) {
    const msgRes = await axios.get(`${GMAIL_BASE}/messages/${msg.id}`, {
      params:  { format: 'metadata', metadataHeaders: 'Subject,From,Date' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const msgData = msgRes.data;
    const parts = flattenParts(msgData.payload?.parts || []);
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId:  part.body.attachmentId,
          messageId:     msg.id,
          fileName:      part.filename,
          mimeType:      part.mimeType,
          fileSizeBytes: part.body.size || 0,
          emailSubject:  getHeader(msgData, 'Subject'),
          emailFrom:     getHeader(msgData, 'From'),
          emailDate:     getHeader(msgData, 'Date'),
        });
      }
    }
  }
  return attachments;
}

async function downloadAttachment(accessToken, messageId, attachmentId) {
  const res = await axios.get(`${GMAIL_BASE}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Gmail returns base64url encoded data
  return Buffer.from(res.data.data, 'base64url');
}

async function revokeToken(plainAccessToken) {
  await axios.post(`${REVOKE_URL}?token=${encodeURIComponent(plainAccessToken)}`).catch(() => {});
}

module.exports = { getAuthUrl, exchangeCode, refreshAccessToken, getAttachments, downloadAttachment, revokeToken };
