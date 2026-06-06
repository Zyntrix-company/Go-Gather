/**
 * Greedy Minimum Cash Flow Algorithm
 *
 * Simplifies a set of debt transactions among a group to minimise
 * the number of transfers needed to settle everyone.
 *
 * Algorithm:
 * 1. Compute net balance for each person
 *    - positive balance → they're owed money (creditor)
 *    - negative balance → they owe money (debtor)
 * 2. Greedily match the largest creditor with the largest debtor
 * 3. Create a transfer for min(|creditor|, |debtor|)
 * 4. Reduce both balances accordingly; repeat until all are zero
 *
 * @param {Array<{from: string, to: string, amount: number}>} transactions
 *   Raw expense & settlement transactions
 *   - from: userId who owes
 *   - to:   userId who is owed
 *   - amount: positive number
 * @returns {Array<{from: string, to: string, amount: number}>}
 *   Simplified minimal set of transactions
 */
const simplifyDebts = (transactions) => {
  // Step 1: compute net balance per user
  const balanceMap = {};

  for (const { from, to, amount } of transactions) {
    if (!balanceMap[from]) balanceMap[from] = 0;
    if (!balanceMap[to]) balanceMap[to] = 0;

    balanceMap[from] -= amount; // owes money → negative
    balanceMap[to] += amount;   // is owed money → positive
  }

  // Round balances to 2dp to avoid floating-point drift
  const balances = Object.entries(balanceMap).map(([userId, balance]) => ({
    userId,
    balance: Math.round(balance * 100) / 100,
  }));

  const result = [];

  // Repeat until all balances are settled
  while (true) {
    // Find max creditor (highest positive balance)
    balances.sort((a, b) => b.balance - a.balance);

    const creditor = balances[0];
    const debtor = balances[balances.length - 1];

    if (!creditor || !debtor) break;
    if (creditor.balance <= 0.005 || debtor.balance >= -0.005) break;

    const transferAmount = Math.min(creditor.balance, -debtor.balance);
    const roundedAmount = Math.round(transferAmount * 100) / 100;

    if (roundedAmount <= 0) break;

    result.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: roundedAmount,
    });

    creditor.balance = Math.round((creditor.balance - roundedAmount) * 100) / 100;
    debtor.balance = Math.round((debtor.balance + roundedAmount) * 100) / 100;
  }

  return result;
};

/**
 * Build the raw transactions array from DB expense splits and settlements.
 *
 * @param {Array} splits   - rows from trip_expense_splits joined with trip_expenses
 *   Each row needs: { paid_by: userId, user_id: userId, amount: number }
 *   In split rows: user_id owes 'amount' to paid_by
 * @param {Array} settlements - rows from trip_settlements
 *   Each row needs: { paid_by: userId, paid_to: userId, amount: number }
 *   Settlements reduce existing debts (paid_by already paid paid_to)
 * @returns {Array<{from, to, amount}>}
 */
const buildTransactions = (splits, settlements) => {
  const transactions = [];

  // Expense split: user_id owes paid_by the split amount
  // (but exclude the payer from their own share)
  for (const split of splits) {
    if (split.user_id === split.paid_by) continue; // payer doesn't owe themselves
    transactions.push({
      from: split.user_id,
      to: split.paid_by,
      amount: parseFloat(split.amount),
    });
  }

  // Settlement: paid_by paid paid_to → reduces the debt direction
  // This is effectively paid_to owes paid_by (reverse the obligation)
  for (const s of settlements) {
    transactions.push({
      from: s.paid_to,  // the one who was owed now "owes back" (since settled)
      to: s.paid_by,
      amount: parseFloat(s.amount),
    });
  }

  return transactions;
};

/**
 * Net balance for one user from raw transactions (expenses + settlements).
 * Positive = owed money, negative = owes money.
 */
const computeUserNetBalance = (transactions, userId) => {
  let balance = 0;
  for (const { from, to, amount } of transactions) {
    if (from === userId) balance -= amount;
    if (to === userId) balance += amount;
  }
  return Math.round(balance * 100) / 100;
};

module.exports = { simplifyDebts, buildTransactions, computeUserNetBalance };
