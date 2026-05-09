/**
 * Idempotent seed: ensure published 1.0.0 privacy + terms from repo markdown.
 * Invoked from migrations/run.js after migrations (not on --down).
 */

const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToSimpleHtml(md) {
  return md
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block.replace(/\s+/g, ' ').trim())}</p>`)
    .join('\n');
}

async function seedLegalDocumentsIfEmpty(pool) {
  const { rows: currentRows } = await pool.query(
    `SELECT document_type FROM legal_document_versions WHERE is_current = true`,
  );
  const have = new Set(currentRows.map((r) => r.document_type));
  if (have.has('privacy') && have.has('terms')) {
    // eslint-disable-next-line no-console
    console.log('Legal documents: current privacy + terms already set.');
    return;
  }

  const repoRoot = path.resolve(__dirname, '../..');
  const privacyPath = path.join(repoRoot, 'frontend/src/imports/privacy-policy.md');
  const termsPath = path.join(repoRoot, 'frontend/src/imports/gathergo-terms-conditions.md');

  let privacyHtml = '<p>Privacy policy content pending.</p>';
  let termsHtml = '<p>Terms and conditions content pending.</p>';

  try {
    if (fs.existsSync(privacyPath)) privacyHtml = mdToSimpleHtml(fs.readFileSync(privacyPath, 'utf8'));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('seed-legal: could not read privacy markdown', e.message);
  }
  try {
    if (fs.existsSync(termsPath)) termsHtml = mdToSimpleHtml(fs.readFileSync(termsPath, 'utf8'));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('seed-legal: could not read terms markdown', e.message);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const effectiveAt = new Date();

    const upsertType = async (documentType, contentHtml) => {
      if (have.has(documentType)) return;
      await client.query(
        `UPDATE legal_document_versions SET is_current = false WHERE document_type = $1`,
        [documentType],
      );
      await client.query(
        `INSERT INTO legal_document_versions
          (document_type, version, content_html, effective_at, published_at, is_current)
         VALUES ($1, '1.0.0', $2, $3, NOW(), true)
         ON CONFLICT (document_type, version) DO UPDATE SET
           content_html = EXCLUDED.content_html,
           effective_at = EXCLUDED.effective_at,
           published_at = NOW(),
           is_current = true`,
        [documentType, contentHtml, effectiveAt],
      );
      await client.query(
        `UPDATE legal_document_versions SET is_current = false
         WHERE document_type = $1 AND version <> '1.0.0'`,
        [documentType],
      );
    };

    await upsertType('privacy', privacyHtml);
    await upsertType('terms', termsHtml);

    await client.query(
      `UPDATE users SET
         privacy_policy_ack_version = COALESCE(privacy_policy_ack_version, '1.0.0'),
         terms_ack_version = COALESCE(terms_ack_version, '1.0.0')`,
    );

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('✔  Seeded legal documents (privacy/terms v1.0.0) where missing; user ack columns backfilled.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedLegalDocumentsIfEmpty, mdToSimpleHtml, escapeHtml };
