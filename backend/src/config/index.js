const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  // ─── Server ──────────────────────────────────
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

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
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },

  // ─── AWS SNS ─────────────────────────────────
  sns: {
    platformAppArnIos: process.env.AWS_SNS_PLATFORM_APP_ARN_IOS,
    platformAppArnAndroid: process.env.AWS_SNS_PLATFORM_APP_ARN_ANDROID,
  },

  // ─── Google OAuth ────────────────────────────
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },

  // ─── Facebook OAuth ───────────────────────────
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },

  // ─── App URLs ────────────────────────────────
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',
  passwordResetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:3001/reset-password',
};
