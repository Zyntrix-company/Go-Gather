/**
 * Single source of truth for text-length / count limits (the app reads them from GET /config/app-limits).
 * Override via env. Restart the server after changes.
 *
 * LIMIT_GALLERY_COMMENT_MAX           — album comment length (default 100; DB column is a 500 ceiling)
 * LIMIT_GALLERY_ALBUM_DESCRIPTION_MAX — album description/subtitle length (default 80)
 * LIMIT_TRIP_NAME_MAX                 — trip name length (default 40)
 * LIMIT_EVENT_NAME_MAX                — event name length (default 40)
 * LIMIT_BIO_MAX                       — profile bio length (default 150)
 * LIMIT_SWEE_MESSAGE_MAX              — Swee chat message length (default 1000)
 * LIMIT_REPORT_REASON_MAX             — Swee report / support report details length (default 500)
 * LIMIT_MAX_LOCATIONS                 — locations per trip/event (default 10)
 * LIMIT_SWEE_TRAVEL_FOCUS_MAX         — travel-focus picks on the Swee trip card (default 3)
 */

const envInt = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const limits = {
  galleryCommentMax: Math.min(envInt('LIMIT_GALLERY_COMMENT_MAX', 100), 500), // DB column ceiling
  galleryAlbumDescriptionMax: envInt('LIMIT_GALLERY_ALBUM_DESCRIPTION_MAX', 80),
  tripNameMax: envInt('LIMIT_TRIP_NAME_MAX', 40),
  eventNameMax: envInt('LIMIT_EVENT_NAME_MAX', 40),
  bioMax: envInt('LIMIT_BIO_MAX', 150),
  sweeMessageMax: envInt('LIMIT_SWEE_MESSAGE_MAX', 1000),
  reportReasonMax: envInt('LIMIT_REPORT_REASON_MAX', 500),
  maxLocations: envInt('LIMIT_MAX_LOCATIONS', 10),
  sweeTravelFocusMax: envInt('LIMIT_SWEE_TRAVEL_FOCUS_MAX', 3),
};

const getPublicAppLimits = () => ({ ...limits });

module.exports = {
  limits,
  getPublicAppLimits,
};
