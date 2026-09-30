const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  // ─── Server ──────────────────────────────────
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Background crons: on in production unless CRON_ENABLED=false; off in dev unless CRON_ENABLED=true
  cronEnabled:
    process.env.CRON_ENABLED === 'true'
    || (process.env.NODE_ENV === 'production' && process.env.CRON_ENABLED !== 'false'),

  // ─── JWT ─────────────────────────────────────
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: '15m',
    refreshExpiresIn: '30d',
    resetExpiresIn: '15m',
  },

  // ─── AWS General ─────────────────────────────
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // ─── AWS RDS (PostgreSQL) ────────────────────
  db: {
    host: process.env.AWS_RDS_HOST,
    port: parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
    database: process.env.AWS_RDS_DB,
    user: process.env.AWS_RDS_USER,
    password: process.env.AWS_RDS_PASSWORD,
  },

  // ─── AWS S3 + CloudFront ─────────────────────
  s3: {
    bucket: process.env.AWS_S3_BUCKET,
    cloudfrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  },

  // ─── AWS SES ─────────────────────────────────
  ses: {
    fromEmail: process.env.AWS_SES_FROM_EMAIL,
    supportEmail: process.env.SUPPORT_EMAIL,
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },

  // ─── AWS SNS ─────────────────────────────────
  sns: {
    platformAppArnIos: process.env.AWS_SNS_PLATFORM_APP_ARN_IOS,
    platformAppArnAndroid: process.env.AWS_SNS_PLATFORM_APP_ARN_ANDROID,
  },

  // ─── Brevo (transactional email) ─────────────
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    fromEmail: process.env.BREVO_FROM_EMAIL,
    fromName: process.env.BREVO_FROM_NAME || 'Gatherrgo',
  },

  // ─── Google OAuth ────────────────────────────
  google: {
    clientId:         process.env.GOOGLE_CLIENT_ID,
    clientSecret:     process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:      process.env.GOOGLE_REDIRECT_URI,
    driveRedirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
    // Places API (Legacy) key from the gatherrgo GCP project — server-side only
    placesApiKey:     process.env.GOOGLE_PLACES_API_KEY,
  },

  // ─── Microsoft / Outlook OAuth ───────────────
  microsoft: {
    clientId:     process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri:  process.env.MICROSOFT_REDIRECT_URI,
    tenantId:     process.env.MICROSOFT_TENANT_ID || 'common',
  },

  // ─── Token Encryption (AES-256-GCM) ──────────
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,

  // ─── Facebook OAuth ───────────────────────────
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },

  // ─── App URLs ────────────────────────────────
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',
  websiteUrl: process.env.WEBSITE_URL || 'https://www.gatherrgo.com',
  passwordResetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:3001/reset-password',
  appDeepLinkBaseUrl: process.env.APP_DEEP_LINK_BASE_URL || 'https://gatherrgo.com',

  // ─── Firebase / FCM v1 ───────────────────────
  // GOOGLE_APPLICATION_CREDENTIALS = path to Firebase service account JSON
  // FIREBASE_PROJECT_ID = Firebase project id (default: gatherrgo)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'gatherrgo',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },

  // ─── Google Gemini ────────────────────────────
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Google retires model ids without warning; keep this overridable from .env
    // so a rename is a config change, not a redeploy.
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  },

  // ─── Invite & App Store Links ─────────────────
  invite: {
    baseUrl:          process.env.APP_INVITE_BASE_URL || 'https://gatherrgo.com/invite',
    appIsLive:        process.env.APP_IS_LIVE === 'true',
    androidApkUrl:    process.env.ANDROID_APK_URL,
    iosTfUrl:         process.env.IOS_TESTFLIGHT_URL,
    androidStoreUrl:  process.env.ANDROID_STORE_URL,
    iosStoreUrl:      process.env.IOS_STORE_URL,
    ogImageUrl:       process.env.OG_INVITE_IMAGE_URL,
  },

  // ─── Upload limits (see config/uploadLimits.js) ─
  uploadLimits: require('./uploadLimits'),

  // ─── Rate Limits ─────────────────────────────
  rateLimits: {
    friendInvitePerHour: parseInt(process.env.FRIEND_INVITE_RATE_LIMIT_PER_HOUR, 10) || 10,
    friendRequestPerDay: parseInt(process.env.FRIEND_REQUEST_RATE_LIMIT_PER_DAY, 10) || 20,
    sweeChatPerHour: parseInt(process.env.SWEE_CHAT_RATE_LIMIT_PER_HOUR, 10) || 30,
    sweeChatPerDay: parseInt(process.env.SWEE_CHAT_RATE_LIMIT_PER_DAY, 10) || 200,
    placesAutocompletePerMinute: parseInt(process.env.PLACES_AUTOCOMPLETE_RATE_LIMIT_PER_MINUTE, 10) || 60,
  },

  // ─── Universal Links ─────────────────────────
  universalLinks: {
    appBundleId:      process.env.APP_BUNDLE_ID      || 'com.gathergo.app',
    appTeamId:        process.env.APP_TEAM_ID        || 'XXXXXXXXXX',
    androidSha256:    process.env.ANDROID_SHA256_CERT,
  },
};
