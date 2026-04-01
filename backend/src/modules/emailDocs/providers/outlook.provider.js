const axios = require('axios');
const config = require('../../../config');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me';

function tokenUrl() {
  const tenant = config.microsoft.tenantId || 'common';
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

function authBase() {
  const tenant = config.microsoft.tenantId || 'common';
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
}

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     config.microsoft.clientId,
    redirect_uri:  config.microsoft.redirectUri,
    response_type: 'code',
    scope:         'offline_access https://graph.microsoft.com/Mail.Read openid email',
    state,
  });
  return `${authBase()}?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await axios.post(tokenUrl(), new URLSearchParams({
    code,
    client_id:     config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    redirect_uri:  config.microsoft.redirectUri,
    grant_type:    'authorization_code',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const data = res.data;

  // Fetch email from Graph /me
  const meRes = await axios.get('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    email:        meRes.data.mail || meRes.data.userPrincipalName,
  };
}

async function refreshAccessToken(plainRefreshToken) {
  const res = await axios.post(tokenUrl(), new URLSearchParams({
    client_id:     config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    refresh_token: plainRefreshToken,
    grant_type:    'refresh_token',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const data = res.data;
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token, // Microsoft may rotate refresh tokens
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  };
}

async function getAttachments(accessToken) {
  const since = thirtyDaysAgo();
  const filter = `hasAttachments eq true and receivedDateTime ge ${since}`;
  const res = await axios.get(`${GRAPH_BASE}/messages`, {
    params: {
      $filter:  filter,
      $select:  'id,subject,from,receivedDateTime',
      $expand:  'attachments($select=id,name,contentType,size,@odata.type)',
      $top:     50,
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const messages = res.data.value || [];
  if (!messages.length) return [];

  const attachments = [];
  for (const msg of messages) {
    const atts = msg.attachments || [];
    for (const att of atts) {
      if (att['@odata.type'] === '#microsoft.graph.fileAttachment') {
        attachments.push({
          attachmentId:  att.id,
          messageId:     msg.id,
          fileName:      att.name,
          mimeType:      att.contentType,
          fileSizeBytes: att.size || 0,
          emailSubject:  msg.subject,
          emailFrom:     msg.from?.emailAddress?.address,
          emailDate:     msg.receivedDateTime,
        });
      }
    }
  }
  return attachments;
}

async function downloadAttachment(accessToken, messageId, attachmentId) {
  const res = await axios.get(`${GRAPH_BASE}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Microsoft Graph returns standard base64
  return Buffer.from(res.data.contentBytes, 'base64');
}

// Outlook has no standard revocation endpoint — caller deletes the DB row
async function revokeToken() {}

module.exports = { getAuthUrl, exchangeCode, refreshAccessToken, getAttachments, downloadAttachment, revokeToken };
