const sharedExpenses = require('../../../shared/expenses/expenses.service');

const PARENT_TYPE = 'trip';

const addExpense = (tripId, createdBy, body) =>
  sharedExpenses.addExpense({ parentType: PARENT_TYPE, parentId: tripId }, createdBy, body);

const getExpenses = (tripId, opts) =>
  sharedExpenses.getExpenses({ parentType: PARENT_TYPE, parentId: tripId }, opts);

const updateExpense = (expId, tripId, requesterId, requesterRole, body) =>
  sharedExpenses.updateExpense({ parentType: PARENT_TYPE, parentId: tripId }, expId, requesterId, requesterRole, body);

const deleteExpense = (expId, tripId, requesterId, requesterRole) =>
  sharedExpenses.deleteExpense({ parentType: PARENT_TYPE, parentId: tripId }, expId, requesterId, requesterRole);

const getBalances = (tripId, userId) =>
  sharedExpenses.getBalances({ parentType: PARENT_TYPE, parentId: tripId }, userId);

const settle = (tripId, payerId, body) =>
  sharedExpenses.settle({ parentType: PARENT_TYPE, parentId: tripId }, payerId, body);

module.exports = { addExpense, getExpenses, updateExpense, deleteExpense, getBalances, settle };
