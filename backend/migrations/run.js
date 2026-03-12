/**
 * Migration runner — executes SQL migration files against the database.
 *
 * Usage:
 *   node migrations/run.js                    # run all pending
 *   node migrations/run.js --down 001         # rollback specific migration
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load env before config (which depends on it)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const config = require('../src/config');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: (config.nodeEnv === 'production' || config.db.host.includes('rds.amazonaws.com'))
    ? { rejectUnauthorized: false }
    : false,
});

const migrationsDir = __dirname;

const run = async () => {
  const args = process.argv.slice(2);
  const isDown = args.includes('--down');
  const targetMigration = isDown ? args[args.indexOf('--down') + 1] : null;

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    if (isDown && targetMigration) {
      // Rollback
      const downFile = `${targetMigration}_down.sql`;
      const filePath = path.join(migrationsDir, downFile);

      if (!fs.existsSync(filePath)) {
        // eslint-disable-next-line no-console
        console.error(`Rollback file not found: ${downFile}`);
        process.exit(1);
      }

      const sql = fs.readFileSync(filePath, 'utf-8');
      await pool.query(sql);

      // Remove from tracking
      const upFile = downFile.replace('_down.sql', '');
      await pool.query(
        'DELETE FROM _migrations WHERE name LIKE $1',
        [`${upFile}%`],
      );

      // eslint-disable-next-line no-console
      console.log(`✔  Rolled back: ${downFile}`);
    } else {
      // Run pending migrations
      const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && !f.includes('_down'))
        .sort();

      const executed = await pool.query('SELECT name FROM _migrations');
      const executedNames = new Set(executed.rows.map((r) => r.name));

      let count = 0;
      for (const file of files) {
        if (executedNames.has(file)) continue;

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await pool.query(sql);
        await pool.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file],
        );

        // eslint-disable-next-line no-console
        console.log(`✔  Executed: ${file}`);
        count++;
      }

      if (count === 0) {
        // eslint-disable-next-line no-console
        console.log('No pending migrations.');
      } else {
        // eslint-disable-next-line no-console
        console.log(`\n✔  ${count} migration(s) applied.`);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();
