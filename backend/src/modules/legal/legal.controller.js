const legalService = require('./legal.service');

const getPrivacy = async (_req, res, next) => {
  try {
    const doc = await legalService.getCurrentPublished('privacy');
    if (!doc) return res.status(404).json({ error: 'NotFound', message: 'Privacy policy is not published yet' });
    return res.json(doc);
  } catch (e) { next(e); }
};

const getTerms = async (_req, res, next) => {
  try {
    const doc = await legalService.getCurrentPublished('terms');
    if (!doc) return res.status(404).json({ error: 'NotFound', message: 'Terms are not published yet' });
    return res.json(doc);
  } catch (e) { next(e); }
};

module.exports = { getPrivacy, getTerms };
