const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

let KEY;
try {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32');
  }
  KEY = Buffer.from(hex, 'hex');
} catch (err) {
  // Throw at module load time so the server fails fast rather than silently
  throw err;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string in the format: iv(12B) + authTag(16B) + ciphertext
 */
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
function decrypt(encryptedBase64) {
  const buf = Buffer.from(encryptedBase64, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
