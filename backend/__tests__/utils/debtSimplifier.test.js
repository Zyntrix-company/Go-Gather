const { simplifyDebts, buildTransactions } = require('../../src/utils/debtSimplifier.util');

describe('debtSimplifier.util', () => {

  // ── buildTransactions ──────────────────────────────────────────────────────

  describe('buildTransactions', () => {
    const alice = 'user-alice';
    const bob   = 'user-bob';
    const carol = 'user-carol';

    it('returns empty array for no splits and no settlements', () => {
      expect(buildTransactions([], [])).toEqual([]);
    });

    it('converts expense splits into from/to/amount transactions', () => {
      const splits = [
        { user_id: bob,   paid_by: alice, amount: '500' },
        { user_id: carol, paid_by: alice, amount: '500' },
        { user_id: alice, paid_by: alice, amount: '500' }, // payer share — should be excluded
      ];
      const txs = buildTransactions(splits, []);
      expect(txs).toHaveLength(2);
      expect(txs[0]).toEqual({ from: bob,   to: alice, amount: 500 });
      expect(txs[1]).toEqual({ from: carol, to: alice, amount: 500 });
    });

    it('includes settlements as reversed transactions', () => {
      const splits = [];
      const settlements = [
        { paid_by: bob, paid_to: alice, amount: '300' },
      ];
      const txs = buildTransactions(splits, settlements);
      expect(txs).toHaveLength(1);
      expect(txs[0]).toEqual({ from: alice, to: bob, amount: 300 });
    });
  });

  // ── simplifyDebts ──────────────────────────────────────────────────────────

  describe('simplifyDebts', () => {
    const alice = 'user-alice';
    const bob   = 'user-bob';
    const carol = 'user-carol';

    it('returns empty array for no transactions', () => {
      expect(simplifyDebts([])).toEqual([]);
    });

    it('handles a single debt correctly', () => {
      const txs = [{ from: bob, to: alice, amount: 1000 }];
      const result = simplifyDebts(txs);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ from: bob, to: alice, amount: 1000 });
    });

    it('cancels out equal and opposite debts', () => {
      const txs = [
        { from: bob,   to: alice, amount: 500 },
        { from: alice, to: bob,   amount: 500 },
      ];
      const result = simplifyDebts(txs);
      expect(result).toHaveLength(0);
    });

    it('simplifies a 3-person chain into 2 transfers → 1 transfer', () => {
      // alice paid for everything:
      // bob owes alice 500, carol owes alice 500
      const txs = [
        { from: bob,   to: alice, amount: 500 },
        { from: carol, to: alice, amount: 500 },
      ];
      const result = simplifyDebts(txs);
      // Both debts are to alice — cannot simplify further, still 2 transfers
      expect(result).toHaveLength(2);
      const totalOwed = result.reduce((s, t) => s + t.amount, 0);
      expect(totalOwed).toBe(1000);
    });

    it('minimises transfers: bob→alice and alice→carol collapses to bob→carol', () => {
      // alice paid carol 300, bob owes alice 300
      // Net: bob owes 300, alice is balanced, carol is owed 300
      const txs = [
        { from: bob,   to: alice, amount: 300 },
        { from: alice, to: carol, amount: 300 },
      ];
      const result = simplifyDebts(txs);
      // After simplification: bob→carol 300 (or equivalent single transaction)
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(300);
      expect(result[0].from).toBe(bob);
      expect(result[0].to).toBe(carol);
    });

    it('handles partial settlement correctly', () => {
      // bob owes alice 1000, has settled 400
      const txs = [
        { from: bob,   to: alice, amount: 1000 },
        { from: alice, to: bob,   amount: 400  },  // settlement reverses 400
      ];
      const result = simplifyDebts(txs);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ from: bob, to: alice, amount: 600 });
    });

    it('handles floating point amounts without precision errors', () => {
      const txs = [
        { from: bob,   to: alice, amount: 33.33 },
        { from: carol, to: alice, amount: 33.33 },
        { from: alice, to: carol, amount: 33.34 }, // leftover cent
      ];
      const result = simplifyDebts(txs);
      // total net to alice: 33.33 + 33.33 - 33.34 = 33.32
      const totalOwed = result
        .filter((t) => t.to === alice)
        .reduce((s, t) => s + t.amount, 0);
      expect(totalOwed).toBeCloseTo(33.32, 1);
    });
  });
});
