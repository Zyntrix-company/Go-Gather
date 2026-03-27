const service = require('./expenses.service');

const addExpense = async (req, res, next) => {
  try {
    const result = await service.addExpense(req.tripMember.tripId, req.user.id, req.body);
    res.status(201).json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const result = await service.getExpenses(req.tripMember.tripId, {
      category,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.status(200).json(result);
  } catch (e) { next(e); }
};

const updateExpense = async (req, res, next) => {
  try {
    const result = await service.updateExpense(
      req.params.eid,
      req.tripMember.tripId,
      req.user.id,
      req.tripMember.role,
      req.body,
    );
    res.status(200).json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const balances = await service.deleteExpense(
      req.params.eid,
      req.tripMember.tripId,
      req.user.id,
      req.tripMember.role,
    );
    res.status(200).json({ success: true, balances });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.error, message: e.message, statusCode: e.statusCode });
    next(e);
  }
};

const getBalances = async (req, res, next) => {
  try {
    const balances = await service.getBalances(req.tripMember.tripId, req.user.id);
    res.status(200).json(balances);
  } catch (e) { next(e); }
};

const settle = async (req, res, next) => {
  try {
    const { withUserId, amount } = req.body;
    if (!withUserId || !amount) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'withUserId and amount are required', statusCode: 400 });
    }
    const outstanding = await service.settle(req.tripMember.tripId, req.user.id, { withUserId, amount });
    res.status(200).json({ outstanding });
  } catch (e) { next(e); }
};

module.exports = { addExpense, getExpenses, updateExpense, deleteExpense, getBalances, settle };
