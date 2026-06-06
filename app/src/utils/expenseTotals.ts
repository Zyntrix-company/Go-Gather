import { resolveExpenseCategory } from '../components/common/CategoryIcons';

export type MemberRosterEntry = { userId: string; name: string };

export type CategoryExpenseTotals = {
  slug: string;
  label: string;
  amount: number;
  color: string;
};

export type MemberExpenseTotals = {
  userId: string;
  name: string;
  shareTotal: number;
  paidTotal: number;
};

export type CurrencyExpenseTotals = {
  currency: string;
  groupTotal: number;
  members: MemberExpenseTotals[];
  categories: CategoryExpenseTotals[];
};

export type GroupExpenseTotals = {
  byCurrency: CurrencyExpenseTotals[];
};

type ExpenseLike = {
  amount: number;
  paidBy: string;
  splitAmong: string[];
  splitType: 'equally' | 'amount' | 'percent';
  currency: string;
  category?: string;
  splitBreakdown?: { userId: string; amount: number }[];
};

/** Sum group spend and per-member share/paid amounts, grouped by currency. */
export function buildGroupExpenseTotals(
  expenses: ExpenseLike[],
  roster: MemberRosterEntry[],
  currentUserId: string,
): GroupExpenseTotals {
  // Group expenses by currency
  const currencyMap = new Map<string, ExpenseLike[]>();
  for (const exp of expenses) {
    const cur = exp.currency || 'INR';
    if (!currencyMap.has(cur)) currencyMap.set(cur, []);
    currencyMap.get(cur)!.push(exp);
  }

  const byCurrency: CurrencyExpenseTotals[] = [];

  for (const [currency, curExpenses] of currencyMap) {
    const byId = new Map<string, MemberExpenseTotals>();
    for (const r of roster) {
      byId.set(r.userId, { userId: r.userId, name: r.name, shareTotal: 0, paidTotal: 0 });
    }

    const nameToUserId = new Map<string, string>();
    for (const r of roster) nameToUserId.set(r.name, r.userId);

    const categoryTotals = new Map<string, CategoryExpenseTotals>();
    let groupTotal = 0;
    for (const exp of curExpenses) {
      groupTotal += exp.amount;

      const catDef = resolveExpenseCategory(exp.category ?? 'general');
      const existing = categoryTotals.get(catDef.slug);
      if (existing) {
        existing.amount += exp.amount;
      } else {
        categoryTotals.set(catDef.slug, {
          slug: catDef.slug,
          label: catDef.label,
          amount: exp.amount,
          color: catDef.color,
        });
      }

      const payerId = nameToUserId.get(exp.paidBy);
      if (payerId && byId.has(payerId)) {
        byId.get(payerId)!.paidTotal += exp.amount;
      }

      if (exp.splitBreakdown?.length) {
        for (const s of exp.splitBreakdown) {
          const entry = byId.get(s.userId);
          if (entry) entry.shareTotal += s.amount;
        }
      } else {
        const participantIds = exp.splitAmong.map(id => (id === 'You' ? currentUserId : id));
        const count = participantIds.length || 1;
        const shareEach = exp.amount / count;
        for (const uid of participantIds) {
          const entry = byId.get(uid);
          if (entry) entry.shareTotal += shareEach;
        }
      }
    }

    const members = roster
      .map(r => byId.get(r.userId)!)
      .sort((a, b) => b.shareTotal - a.shareTotal);

    const categories = [...categoryTotals.values()]
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    byCurrency.push({ currency, groupTotal, members, categories });
  }

  byCurrency.sort((a, b) => b.groupTotal - a.groupTotal);

  return { byCurrency };
}

export function buildExpenseMemberRoster(
  members: { userId: string; fullName?: string; name?: string }[],
  currentUserId: string,
): MemberRosterEntry[] {
  const roster: MemberRosterEntry[] = [
    { userId: currentUserId, name: 'You' },
  ];
  for (const m of members) {
    if (m.userId === currentUserId) continue;
    roster.push({
      userId: m.userId,
      name: m.fullName ?? (m as { name?: string }).name ?? 'Member',
    });
  }
  return roster;
}
