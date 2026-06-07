import { formatCurrencyFull } from './currency';

const EPS = 0.005;

/** Row label for expense list — omit when user neither owes nor is owed. */
export function getExpenseRowBalanceLabel(exp: {
  amount: number;
  currency: string;
  paidBy: string;
  myAmount?: number;
}): { text: string; color: string } | null {
  const myAmt = exp.myAmount ?? 0;
  const iPaid = exp.paidBy === 'You';

  if (iPaid) {
    const lent = exp.amount - myAmt;
    if (lent > EPS) {
      return { text: `You lent ${formatCurrencyFull(lent, exp.currency)}`, color: '#0d9488' };
    }
  } else if (myAmt > EPS) {
    return { text: `You owe ${formatCurrencyFull(myAmt, exp.currency)}`, color: '#ef4444' };
  }

  return null;
}

export function isSignificantAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > EPS;
}
