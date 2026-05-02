const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Module routers
const authRoutes    = require('./modules/auth/routes');
const usersRoutes   = require('./modules/users/routes');
const homeRoutes    = require('./modules/home/home.routes');
const tripsRoutes   = require('./modules/trips/trips.routes');
const eventsRoutes  = require('./modules/events/events.routes');
const friendsRoutes = require('./modules/friends/friends.routes');
const invitesRoutes = require('./modules/invites/invites.routes');
const contactRoutes = require('./modules/contact/contact.routes');
const { authRouter: emailAuthRoutes, emailDocsRouter } = require('./modules/emailDocs/emailDocs.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const blogsRoutes         = require('./modules/blogs/blogs.routes');
const dealsRoutes         = require('./modules/deals/deals.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const adminRoutes        = require('./modules/admin/admin.routes');
const { recordRequest }  = require('./modules/admin/admin.middleware');

const app = express();

/* ───────────────────────────────────────────
 * Universal Links / App Links — BEFORE any auth middleware
 * Must be served as application/json without a .json extension in the URL.
 * ─────────────────────────────────────────── */
app.get('/.well-known/apple-app-site-association', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'static/apple-app-site-association'));
});

app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'static/assetlinks.json'));
});

/* ───────────────────────────────────────────
 * Global Middleware
 * ─────────────────────────────────────────── */
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [config.clientUrl];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
// Skip JSON/urlencoded parsing for multipart requests — multer handles those at route level
app.use((req, _res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
    return next();
  }
  express.json({ limit: '50mb' })(req, _res, next);
});
app.use((req, _res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50mb' })(req, _res, next);
});

// In-process request counter for admin health endpoint
app.use(recordRequest);

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
app.use('/auth',    authRoutes);
app.use('/users',   usersRoutes);
app.use('/home',    homeRoutes);
app.use('/trips',   tripsRoutes);
app.use('/events',  eventsRoutes);
app.use('/friends', friendsRoutes);
app.use('/invites', invitesRoutes);
app.use('/ai',            aiRoutes);
app.use('/blogs',         blogsRoutes);
app.use('/deals',         dealsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/admin',       adminRoutes);
app.use('/auth',        emailAuthRoutes);
app.use('/email-docs',  emailDocsRouter);

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
