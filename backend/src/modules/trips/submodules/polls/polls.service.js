const sharedPolls = require('../../../shared/polls/polls.service');

const PARENT_TYPE = 'trip';

const createPoll = (tripId, userId, body) =>
  sharedPolls.createPoll({ parentType: PARENT_TYPE, parentId: tripId }, userId, body);

const vote = (tripId, pollId, userId, optionId) =>
  sharedPolls.vote({ parentType: PARENT_TYPE, parentId: tripId }, pollId, userId, optionId);

const getPolls = (tripId, userId) =>
  sharedPolls.getPolls({ parentType: PARENT_TYPE, parentId: tripId }, userId);

const deletePoll = (tripId, pollId, userId) =>
  sharedPolls.deletePoll({ parentType: PARENT_TYPE, parentId: tripId }, pollId, userId);

module.exports = { createPoll, vote, getPolls, deletePoll };
