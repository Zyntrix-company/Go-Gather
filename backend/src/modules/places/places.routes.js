/**
 * Google Places (Legacy) proxy. The app never holds the Maps key — it calls
 * GET /places/autocomplete and we forward to Google with GOOGLE_PLACES_API_KEY.
 * Rotating the key is then a backend env change only, no app release.
 */
const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const authenticateJWT = require('../../middleware/authenticate');
const config = require('../../config');
const logger = require('../../utils/logger');

const router = express.Router();

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 200;
const MAX_SUGGESTIONS = 6;

// Every call is billed per request, so cap per user to stop runaway typing loops/abuse.
const autocompleteLimit = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimits.placesAutocompletePerMinute,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: 'RATE_LIMITED', message: 'Too many location searches, slow down a little.', statusCode: 429,
  }),
});

router.get('/autocomplete', authenticateJWT, autocompleteLimit, async (req, res) => {
  const input = typeof req.query.input === 'string' ? req.query.input.trim() : '';

  if (input.length < MIN_QUERY_LEN) {
    return res.json({ predictions: [] });
  }

  if (!config.google.placesApiKey) {
    logger.error('Places autocomplete called but GOOGLE_PLACES_API_KEY is not set');
    return res.status(503).json({ error: 'PLACES_UNAVAILABLE', message: 'Location search is unavailable', statusCode: 503 });
  }

  try {
    const { data } = await axios.get(AUTOCOMPLETE_URL, {
      params: {
        input: input.slice(0, MAX_QUERY_LEN),
        key: config.google.placesApiKey,
        language: 'en',
      },
      timeout: 5000,
    });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error('Places autocomplete failed', { status: data.status, error: data.error_message });
      return res.status(502).json({ error: 'PLACES_ERROR', message: 'Location search failed', statusCode: 502 });
    }

    const predictions = (data.predictions ?? [])
      .slice(0, MAX_SUGGESTIONS)
      .map((p) => ({ place_id: p.place_id, description: p.description }));

    res.json({ predictions });
  } catch (err) {
    logger.error('Places autocomplete request error', { error: err.message });
    res.status(502).json({ error: 'PLACES_ERROR', message: 'Location search failed', statusCode: 502 });
  }
});

module.exports = router;
