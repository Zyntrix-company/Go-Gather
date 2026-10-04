/**
 * Global test setup — set all environment variables BEFORE any module loads.
 * Loaded via jest.config.js `setupFiles` so it runs before each test file.
 */
process.env.NODE_ENV = 'test';

// ── JWT ───────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-min!';

// ── AWS General ───────────────────────────────────────────────────────────────
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

// ── Database (never actually connected in unit tests — DB is mocked) ──────────
process.env.AWS_RDS_HOST = 'localhost';
process.env.AWS_RDS_PORT = '5432';
process.env.AWS_RDS_DB = 'gathergo_test';
process.env.AWS_RDS_USER = 'postgres';
process.env.AWS_RDS_PASSWORD = 'postgres';

// ── S3 / CloudFront ───────────────────────────────────────────────────────────
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_CLOUDFRONT_DOMAIN = 'test.cloudfront.net';

// ── SES ───────────────────────────────────────────────────────────────────────
process.env.AWS_SES_FROM_EMAIL = 'noreply@gatherrgo.com';
process.env.AWS_SES_ACCESS_KEY_ID = 'test-ses-key';
process.env.AWS_SES_SECRET_ACCESS_KEY = 'test-ses-secret';

// ── Brevo ─────────────────────────────────────────────────────────────────────
process.env.BREVO_API_KEY = 'test-brevo-api-key';
process.env.BREVO_FROM_EMAIL = 'noreply@gatherrgo.com';

// ── SNS ───────────────────────────────────────────────────────────────────────
process.env.AWS_SNS_PLATFORM_APP_ARN_IOS = 'arn:aws:sns:us-east-1:123456789:app/APNS/test';
process.env.AWS_SNS_PLATFORM_APP_ARN_ANDROID = 'arn:aws:sns:us-east-1:123456789:app/GCM/test';

// ── FCM ───────────────────────────────────────────────────────────────────────
process.env.FCM_SERVER_KEY = 'test-fcm-server-key';

// ── Google OAuth ──────────────────────────────────────────────────────────
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

// ── App URLs ──────────────────────────────────────────────────────────────────
process.env.CLIENT_URL = 'http://localhost:3001';
process.env.PASSWORD_RESET_URL = 'http://localhost:3001/reset-password';
process.env.APP_DEEP_LINK_BASE_URL = 'https://gatherrgo.com';
process.env.APP_INVITE_BASE_URL = 'https://gatherrgo.com/invite';

// ── App install links ─────────────────────────────────────────────────────────
process.env.APP_IS_LIVE = 'false';
process.env.ANDROID_APK_URL = 'https://test.example.com/test.apk';
process.env.IOS_TESTFLIGHT_URL = 'https://testflight.apple.com/join/TEST';
process.env.ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gathergo.app';
process.env.IOS_STORE_URL = 'https://apps.apple.com/app/gathergo/id123456';
process.env.OG_INVITE_IMAGE_URL = 'https://cdn.gatherrgo.com/og.png';

// ── Universal Links ───────────────────────────────────────────────────────────
process.env.APP_BUNDLE_ID = 'com.gathergo';
process.env.APP_TEAM_ID = 'TESTTEAMID';
process.env.ANDROID_SHA256_CERT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

// ── Rate limits ───────────────────────────────────────────────────────────────
process.env.FRIEND_INVITE_RATE_LIMIT_PER_HOUR = '10';
process.env.FRIEND_REQUEST_RATE_LIMIT_PER_DAY = '20';
