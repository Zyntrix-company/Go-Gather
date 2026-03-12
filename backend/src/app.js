const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Module routers
const authRoutes = require('./modules/auth/routes');
const usersRoutes = require('./modules/users/routes');

const app = express();

/* ───────────────────────────────────────────
 * Global Middleware
 * ─────────────────────────────────────────── */
app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging via morgan → winston
const morganStream = {
  write: (message) => logger.http(message.trim()),
};
app.use(morgan('combined', {
  stream: morganStream,
  skip: () => config.nodeEnv === 'test',
}));

/* ───────────────────────────────────────────
 * Health Check
 * ─────────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

/* ───────────────────────────────────────────
 * API Routes
 * ─────────────────────────────────────────── */
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);

/* ───────────────────────────────────────────
 * 404 Handler
 * ─────────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested resource was not found',
    statusCode: 404,
  });
});

/* ───────────────────────────────────────────
 * Centralised Error Handler (must be last)
 * ─────────────────────────────────────────── */
app.use(errorHandler);

module.exports = app;
