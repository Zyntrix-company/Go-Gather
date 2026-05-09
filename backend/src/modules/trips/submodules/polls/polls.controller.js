const service = require('./polls.service');

const createPoll = async (req, res, next) => {
  try {
    const poll = await service.createPoll(req.tripMember.tripId, req.user.id, req.body);
    res.status(201).json({ poll });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const vote = async (req, res, next) => {
  try {
    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'optionId is required', statusCode: 400 });
    }
    const poll = await service.vote(req.tripMember.tripId, req.params.pollId, req.user.id, optionId);
    res.status(200).json({ poll });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getPolls = async (req, res, next) => {
  try {
    const polls = await service.getPolls(req.tripMember.tripId, req.user.id);
    res.status(200).json({ polls });
  } catch (e) { next(e); }
};

const deletePoll = async (req, res, next) => {
  try {
    await service.deletePoll(req.tripMember.tripId, req.params.pollId, req.user.id);
    res.status(200).json({ success: true });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

module.exports = { createPoll, vote, getPolls, deletePoll };
