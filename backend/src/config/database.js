const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: (config.nodeEnv === 'production' || config.db.host.includes('rds.amazonaws.com'))
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text  SQL query string
 * @param {Array}  params  query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Acquire a dedicated client for transactions.
 * Caller MUST release the client when done.
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
