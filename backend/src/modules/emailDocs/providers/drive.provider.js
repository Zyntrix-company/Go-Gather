const axios = require('axios');
const config = require('../../../config');

const AUTH_BASE  = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

// File types the app accepts from Drive (matches emailDocs ALLOWED_MIME_TYPES + common doc formats)
const ALLOWED_DRIVE_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     config.google.clientId,
    redirect_uri:  config.google.driveRedirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.readonly openid email',
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
    redirect_uri:  config.google.driveRedirectUri,
    grant_type:    'authorization_code',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const data = res.data;
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

async function listFiles(accessToken, folderId) {
  const parent = folderId || 'root';
  // Exclude Google Workspace documents (Docs, Sheets, Slides) — they can't be downloaded directly.
  // Only list real files whose MIME type the app supports.
  const mimeFilter = ALLOWED_DRIVE_MIMES.map(m => `mimeType='${m}'`).join(' or ');
  const q = `'${parent}' in parents and trashed=false and (${mimeFilter})`;

  const res = await axios.get(`${DRIVE_BASE}/files`, {
    params: {
      q,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      pageSize: 50,
      orderBy:  'modifiedTime desc',
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return (res.data.files || []).map(f => ({
    fileId:       f.id,
    name:         f.name,
    mimeType:     f.mimeType,
    sizeBytes:    f.size ? parseInt(f.size, 10) : null,
    modifiedTime: f.modifiedTime,
  }));
}

async function downloadFile(accessToken, fileId) {
  const res = await axios.get(`${DRIVE_BASE}/files/${fileId}`, {
    params:       { alt: 'media' },
    headers:      { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(res.data);
}

async function revokeToken(plainAccessToken) {
  await axios.post(`${REVOKE_URL}?token=${encodeURIComponent(plainAccessToken)}`).catch(() => {});
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  listFiles,
  downloadFile,
  revokeToken,
};
