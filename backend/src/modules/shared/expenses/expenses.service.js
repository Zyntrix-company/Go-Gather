const { query: db, getClient } = require('../../../config/database');
const { simplifyDebts, buildTransactions } = require('../../../utils/debtSimplifier.util');
const { createAndSendNotifications } = require('../../../utils/fcm.util');

const VALID_CATEGORIES = ['general', 'transportation', 'accommodation', 'entertainment', 'shopping', 'food', 'other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertParentMember = async (parentType, parentId, userId, label = 'User') => {
  const table = parentType === 'trip' ? 'trip_members' : 'event_members';
  const col   = parentType === 'trip' ? 'trip_id'     : 'event_id';
  const result = await db(
    `SELECT 1 FROM ${table} WHERE ${col} = $1 AND user_id = $2`,
    [parentId, userId],
  );
  if (result.rowCount === 0) {
    const e = new Error(`${label} is not a member of this ${parentType}`);
    e.statusCode = 422; e.error = 'VALIDATION_ERROR'; throw e;
  }
};

const computeSplits = (totalAmount, splitType, splitAmong, payerId) => {
  const total = parseFloat(totalAmount);

  if (splitType === 'equal') {
    const count = splitAmong.length;
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - baseAmount * count) * 100) / 100;
    const payerIndexInSplit = splitAmong.findIndex((x) => x.userId === payerId);
    const targetIndex = payerIndexInSplit !== -1 ? payerIndexInSplit : 0;
    return splitAmong.map((s, i) => ({
      userId: s.userId,
      amount: i === targetIndex ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount,
      percentage: null,
    }));
  }

  if (splitType === 'amount') {
    const splitTotal = splitAmong.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    if (Math.abs(Math.round(splitTotal * 100) - Math.round(total * 100)) > 1) {
      const e = new Error(`Split amounts sum (${splitTotal.toFixed(2)}) must equal total amount (${total.toFixed(2)})`);
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
    return splitAmong.map((s) => ({ userId: s.userId, amount: parseFloat(s.amount), percentage: null }));
  }

  if (splitType === 'percentage') {
    const percentageTotal = splitAmong.reduce((sum, s) => sum + parseFloat(s.percentage || 0), 0);
    if (Math.abs(Math.round(percentageTotal * 100) - 10000) > 1) {
      const e = new Error(`Split percentages must sum to 100.00 (got ${percentageTotal.toFixed(2)})`);
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
    let assigned = 0;
    const splits = splitAmong.map((s) => {
      const pct = parseFloat(s.percentage);
      const computed = Math.floor((total * pct / 100) * 100) / 100;
      assigned += computed;
      return { userId: s.userId, amount: computed, percentage: pct };
    });
    const remainder = Math.round((total - assigned) * 100) / 100;
    if (remainder !== 0) {
      const payerIdx = splits.findIndex((s) => s.userId === payerId);
      const targetIdx = payerIdx !== -1 ? payerIdx : 0;
      splits[targetIdx].amount = Math.round((splits[targetIdx].amount + remainder) * 100) / 100;
    }
    return splits;
  }

  throw new Error('Invalid splitType');
};

const computeSimplifiedDebts = async (parentType, parentId) => {
  const splitsResult = await db(
    `SELECT es.user_id, es.amount, e.paid_by
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.parent_type = $1 AND e.parent_id = $2`,
    [parentType, parentId],
  );
  const settlementsResult = await db(
    `SELECT paid_by, paid_to, amount FROM settlements WHERE parent_type = $1 AND parent_id = $2`,
    [parentType, parentId],
  );
  return simplifyDebts(buildTransactions(splitsResult.rows, settlementsResult.rows));
};

const enrichSimplifiedDebts = async (simplified, currentUserId = null) => {
  const allIds = [];
  for (const t of simplified) { allIds.push(t.from, t.to); }
  const profiles = await fetchProfiles(allIds);
  return simplified.map((t) => ({
    from: t.from,
    to: t.to,
    fromName: currentUserId && t.from === currentUserId ? 'You' : (profiles[t.from]?.name || 'Member'),
    toName:   currentUserId && t.to   === currentUserId ? 'You' : (profiles[t.to]?.name   || 'Member'),
    amount: t.amount,
  }));
};

// ─── Add Expense ──────────────────────────────────────────────────────────────

const addExpense = async ({ parentType, parentId }, createdBy, body) => {
  const { description, amount, category, paidBy, splitType, splitAmong } = body;

  const resolvedCategory = VALID_CATEGORIES.includes(category) ? category : 'general';

  await assertParentMember(parentType, parentId, paidBy, 'Payer');
  for (const s of splitAmong) {
    await assertParentMember(parentType, parentId, s.userId, `Split member ${s.userId}`);
  }

  const splits = computeSplits(amount, splitType, splitAmong, paidBy);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const expResult = await client.query(
      `INSERT INTO expenses (parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [parentType, parentId, description, amount, resolvedCategory, paidBy, splitType, createdBy],
    );
    const expense = expResult.rows[0];

    for (const s of splits) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)`,
        [expense.id, s.userId, s.amount, s.percentage],
      );
    }

    await client.query('COMMIT');

    const userIds = [paidBy, ...splits.map((s) => s.userId)];
    const profiles = await fetchProfiles(userIds);

    const simplified = await computeSimplifiedDebts(parentType, parentId);
    const balances = await enrichSimplifiedDebts(simplified, createdBy);

    // Notify other members — fire-and-forget (outside transaction)
    const expenseId = expense.id;
    const expenseAmount = parseFloat(expense.amount);
    setImmediate(async () => {
      try {
        const memberTable = parentType === 'trip' ? 'trip_members' : 'event_members';
        const parentCol   = parentType === 'trip' ? 'trip_id'     : 'event_id';
        const parentTable = parentType === 'trip' ? 'trips'       : 'events';
        const [membersResult, parentResult, actorResult] = await Promise.all([
          db(`SELECT u.id, u.fcm_token FROM ${memberTable} tm JOIN users u ON u.id = tm.user_id WHERE tm.${parentCol} = $1 AND tm.user_id != $2`, [parentId, createdBy]),
          db(`SELECT name FROM ${parentTable} WHERE id = $1`, [parentId]),
          db('SELECT full_name FROM profiles WHERE user_id = $1', [createdBy]),
        ]);
        if (membersResult.rows.length === 0) return;
        const parentName = parentResult.rows[0]?.name || 'Your group';
        const actorName  = actorResult.rows[0]?.full_name || 'Someone';
        const dataPayload = parentType === 'trip'
          ? { tripId: parentId, tripName: parentName, amount: String(expenseAmount), expenseId }
          : { eventId: parentId, parentName, amount: String(expenseAmount), expenseId };
        createAndSendNotifications(
          membersResult.rows,
          { title: 'New Expense Added', body: `${actorName} added an expense of ${expenseAmount} to "${parentName}".` },
          'EXPENSE_ADDED',
          dataPayload,
          { batched: true },
        );
      } catch (_) { /* fire-and-forget */ }
    });

    return {
      expense: formatExpense(expense, splits, profiles),
      balances,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ─── Get Expenses ─────────────────────────────────────────────────────────────

const getExpenses = async ({ parentType, parentId }, { category, page = 1, limit = 20 } = {}) => {
  const safLimit = Math.min(limit, 100);
  const offset = (page - 1) * safLimit;

  const params = [parentType, parentId];
  let catFilter = '';
  if (category) { catFilter = `AND e.category = $${params.push(category)}`; }

  const grandTotalResult = await db(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS grand_total
     FROM expenses WHERE parent_type = $1 AND parent_id = $2`,
    [parentType, parentId],
  );
  const grandTotal = parseFloat(grandTotalResult.rows[0].grand_total);

  const result = await db(
    `SELECT
       e.*,
       COUNT(*) OVER()::int AS total_count,
       pp.full_name  AS paid_by_name,
       pp.avatar_url AS paid_by_avatar,
       json_agg(
         json_build_object(
           'userId',     es.user_id,
           'name',       sp.full_name,
           'avatarUrl',  sp.avatar_url,
           'amount',     es.amount,
           'percentage', es.percentage
         ) ORDER BY es.user_id
       ) FILTER (WHERE es.id IS NOT NULL) AS splits
     FROM expenses e
     LEFT JOIN profiles pp ON pp.user_id = e.paid_by
     LEFT JOIN expense_splits es ON es.expense_id = e.id
     LEFT JOIN profiles sp ON sp.user_id = es.user_id
     WHERE e.parent_type = $1 AND e.parent_id = $2 ${catFilter}
     GROUP BY e.id, pp.full_name, pp.avatar_url
     ORDER BY e.created_at DESC
     LIMIT $${params.push(safLimit)} OFFSET $${params.push(offset)}`,
    params,
  );

  const total = result.rows[0]?.total_count || 0;
  const expenses = result.rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: parseFloat(row.amount),
    category: row.category,
    paidBy: {
      userId: row.paid_by,
      name: row.paid_by_name || null,
      avatarUrl: row.paid_by_avatar || null,
    },
    splitType: row.split_type,
    createdBy: row.created_by,
    splits: (row.splits || []).map((s) => ({
      userId: s.userId,
      name: s.name || null,
      avatarUrl: s.avatarUrl || null,
      amount: parseFloat(s.amount),
      percentage: s.percentage ? parseFloat(s.percentage) : null,
    })),
    createdAt: row.created_at,
  }));

  return { expenses, total, page, limit: safLimit, grandTotal };
};

// ─── Update Expense ───────────────────────────────────────────────────────────

const updateExpense = async ({ parentType, parentId }, expId, requesterId, requesterRole, body) => {
  const expResult = await db(
    'SELECT * FROM expenses WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [expId, parentType, parentId],
  );
  if (expResult.rowCount === 0) {
    const e = new Error('Expense not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const existing = expResult.rows[0];

  if (existing.created_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the creator or an admin can edit this expense');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  const amount   = body.amount    !== undefined ? body.amount    : parseFloat(existing.amount);
  const splitType = body.splitType !== undefined ? body.splitType : existing.split_type;
  const paidBy   = body.paidBy    !== undefined ? body.paidBy    : existing.paid_by;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const fields = []; const values = []; let idx = 1;
    if (body.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.description); }
    if (body.amount      !== undefined) { fields.push(`amount = $${idx++}`);      values.push(body.amount); }
    if (body.category    !== undefined) {
      const cat = VALID_CATEGORIES.includes(body.category) ? body.category : 'general';
      fields.push(`category = $${idx++}`); values.push(cat);
    }
    if (body.paidBy    !== undefined) { fields.push(`paid_by = $${idx++}`);    values.push(body.paidBy); }
    if (body.splitType !== undefined) { fields.push(`split_type = $${idx++}`); values.push(body.splitType); }

    let updatedExp = existing;
    if (fields.length > 0) {
      values.push(expId);
      const upd = await client.query(
        `UPDATE expenses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        values,
      );
      updatedExp = upd.rows[0];
    }

    let splits;
    if (body.splitAmong) {
      splits = computeSplits(amount, splitType, body.splitAmong, paidBy);
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expId]);
      for (const s of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)`,
          [expId, s.userId, s.amount, s.percentage],
        );
      }
    } else {
      const splitsResult = await db('SELECT * FROM expense_splits WHERE expense_id = $1', [expId]);
      splits = splitsResult.rows.map((r) => ({ userId: r.user_id, amount: parseFloat(r.amount), percentage: r.percentage }));
    }

    await client.query('COMMIT');

    const userIds = [updatedExp.paid_by, ...splits.map((s) => s.userId)];
    const profiles = await fetchProfiles(userIds);

    const simplified = await computeSimplifiedDebts(parentType, parentId);
    const balances = await enrichSimplifiedDebts(simplified, requesterId);
    return { expense: formatExpense(updatedExp, splits, profiles), balances };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
};

// ─── Delete Expense ───────────────────────────────────────────────────────────

const deleteExpense = async ({ parentType, parentId }, expId, requesterId, requesterRole) => {
  const expResult = await db(
    'SELECT * FROM expenses WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [expId, parentType, parentId],
  );
  if (expResult.rowCount === 0) {
    const e = new Error('Expense not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const exp = expResult.rows[0];

  if (exp.created_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the creator or an admin can delete this expense');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  await db('DELETE FROM expenses WHERE id = $1', [expId]);
  const simplified = await computeSimplifiedDebts(parentType, parentId);
  return enrichSimplifiedDebts(simplified, requesterId);
};

// ─── Get Balances ─────────────────────────────────────────────────────────────

const getBalances = async ({ parentType, parentId }, userId) => {
  const [paidResult, shareResult, totalResult] = await Promise.all([
    db(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM expenses WHERE parent_type = $1 AND parent_id = $2 AND paid_by = $3`,
      [parentType, parentId, userId],
    ),
    db(
      `SELECT COALESCE(SUM(es.amount), 0) AS total_share
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.parent_type = $1 AND e.parent_id = $2 AND es.user_id = $3`,
      [parentType, parentId, userId],
    ),
    db(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE parent_type = $1 AND parent_id = $2`,
      [parentType, parentId],
    ),
  ]);

  const youPaid    = parseFloat(paidResult.rows[0].total_paid);
  const yourShare  = parseFloat(shareResult.rows[0].total_share);
  const yoursTotal = parseFloat(totalResult.rows[0].total);

  const simplified = await computeSimplifiedDebts(parentType, parentId);
  const debts = await enrichSimplifiedDebts(simplified, userId);

  return {
    debts,
    myBalance: Math.round((youPaid - yourShare) * 100) / 100,
    totalExpenses: String(yoursTotal),
  };
};

// ─── Settle ───────────────────────────────────────────────────────────────────

const settle = async ({ parentType, parentId }, payerId, { withUserId, amount }) => {
  await db(
    'INSERT INTO settlements (parent_type, parent_id, paid_by, paid_to, amount) VALUES ($1, $2, $3, $4, $5)',
    [parentType, parentId, payerId, withUserId, amount],
  );
  const simplified = await computeSimplifiedDebts(parentType, parentId);
  return enrichSimplifiedDebts(simplified, payerId);
};

// ─── Profile batch fetch helper ───────────────────────────────────────────────

const fetchProfiles = async (userIds) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const result = await db(
    'SELECT user_id, full_name, avatar_url FROM profiles WHERE user_id = ANY($1::uuid[])',
    [uniqueIds],
  );
  const map = {};
  for (const row of result.rows) {
    map[row.user_id] = { name: row.full_name || null, avatarUrl: row.avatar_url || null };
  }
  return map;
};

// ─── Format helpers ───────────────────────────────────────────────────────────

const formatExpense = (e, splits, profiles = {}) => {
  const paidByProfile = profiles[e.paid_by] || {};
  return {
    id: e.id,
    parentType: e.parent_type,
    parentId: e.parent_id,
    description: e.description,
    amount: parseFloat(e.amount),
    category: e.category || 'general',
    createdBy: e.created_by,
    paidBy: {
      userId: e.paid_by,
      name: paidByProfile.name || null,
      avatarUrl: paidByProfile.avatarUrl || null,
    },
    splitType: e.split_type,
    splits: splits.map((s) => {
      const uid = s.userId || s.user_id;
      const prof = profiles[uid] || {};
      return {
        userId: uid,
        name: prof.name || null,
        avatarUrl: prof.avatarUrl || null,
        amount: parseFloat(s.amount),
        percentage: s.percentage ? parseFloat(s.percentage) : null,
      };
    }),
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
};

module.exports = { addExpense, getExpenses, updateExpense, deleteExpense, getBalances, settle };
