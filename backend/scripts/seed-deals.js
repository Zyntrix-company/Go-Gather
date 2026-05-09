/**
 * One-shot: creates the deals table (if not exists) and seeds the 6 static deals.
 * Safe to re-run — table creation uses IF NOT EXISTS, seed uses ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   node backend/scripts/seed-deals.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { query, pool } = require('../src/config/database');

async function main() {
  // ── 1. Create table ──────────────────────────────────────────
  console.log('Creating deals table...');
  await query(`
    CREATE TABLE IF NOT EXISTS deals (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(120)  NOT NULL,
      subtitle    VARCHAR(200),
      image_url   TEXT          NOT NULL,
      hyperlink   TEXT,
      sort_order  INTEGER,
      active      BOOLEAN       NOT NULL DEFAULT true,
      created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_deals_active
      ON deals (sort_order NULLS LAST, created_at DESC)
      WHERE active = true
  `);

  // Create trigger only if it doesn't already exist
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_deals_updated_at'
      ) THEN
        CREATE TRIGGER update_deals_updated_at
          BEFORE UPDATE ON deals
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END
    $$
  `);

  console.log('  deals table ready.');

  // ── 2. Seed deals ─────────────────────────────────────────────
  console.log('Seeding deals...');

  const DEALS = [
    {
      title: 'Taj Coral Reef, Maldives',
      subtitle: 'Overwater villas from ₹18,999/night',
      image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 1,
    },
    {
      title: 'The Leela Goa',
      subtitle: 'Beachfront stay from ₹7,499/night',
      image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 2,
    },
    {
      title: 'Zostel Manali',
      subtitle: 'Hostel dorms from ₹599/night',
      image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 3,
    },
    {
      title: 'Goa Airport Cab',
      subtitle: 'AC sedan to North Goa — flat ₹699',
      image_url: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 4,
    },
    {
      title: 'Manali Innova Crysta',
      subtitle: 'Hill station cab for 6 — ₹3,499/day',
      image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 5,
    },
    {
      title: 'Spiti Valley Trek',
      subtitle: '7-day package from ₹14,999',
      image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop',
      hyperlink: null,
      sort_order: 6,
    },
  ];

  for (const deal of DEALS) {
    const { rowCount } = await query(
      `INSERT INTO deals (title, subtitle, image_url, hyperlink, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT DO NOTHING`,
      [deal.title, deal.subtitle, deal.image_url, deal.hyperlink, deal.sort_order],
    );
    console.log(`  ${rowCount ? 'inserted' : 'skipped (exists)'} — ${deal.title}`);
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
