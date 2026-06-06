/** Close inline expense forms and dropdowns without changing layout. */
export function closeExpenseOverlays(setters: {
  setShowAddExpense: (v: boolean) => void;
  setEditingExpenseId: (v: string | null) => void;
  setShowExpCurrencyDrop: (v: boolean) => void;
  setShowExpCatDrop: (v: boolean) => void;
  setShowPaidByDrop: (v: boolean) => void;
}) {
  setters.setShowAddExpense(false);
  setters.setEditingExpenseId(null);
  setters.setShowExpCurrencyDrop(false);
  setters.setShowExpCatDrop(false);
  setters.setShowPaidByDrop(false);
}

export function settleDebtKey(from: string, to: string, currency: string): string {
  return `${from}|${to}|${currency}`;
}
