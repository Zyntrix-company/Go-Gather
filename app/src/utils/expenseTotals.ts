import { resolveExpenseCategory } from '../components/common/CategoryIcons';

export type MemberRosterEntry = { userId: string; name: string; avatarUrl?: string | null };

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
    if (!Number.isFinite(exp.amount) || exp.amount <= 0) continue;
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
  members: { userId: string; fullName?: string; name?: string; avatarUrl?: string | null }[],
  currentUserId: string,
  currentUserAvatar?: string | null,
): MemberRosterEntry[] {
  const roster: MemberRosterEntry[] = [
    { userId: currentUserId, name: 'You', avatarUrl: currentUserAvatar ?? null },
  ];
  for (const m of members) {
    if (m.userId === currentUserId) continue;
    roster.push({
      userId: m.userId,
      name: m.fullName ?? (m as { name?: string }).name ?? 'Member',
      avatarUrl: m.avatarUrl ?? null,
    });
  }
  return roster;
}

/**
 * Net direct balance between the current user and every other member, per currency.
 * Only counts expenses where one side paid and the other was a split participant —
 * unlike the group-wide debt-minimization graph, this never routes a balance through
 * a third member, so it always reflects money that changed hands between these two people.
 *
 * Positive = that member owes the current user (current user lent them money).
 * Negative = the current user owes that member.
 */
export function buildPairwiseMemberBalances(
  expenses: ExpenseLike[],
  roster: MemberRosterEntry[],
  currentUserId: string,
): Record<string, Record<string, number>> {
  const nameToUserId = new Map<string, string>();
  for (const r of roster) nameToUserId.set(r.name, r.userId);

  const result: Record<string, Record<string, number>> = {};

  for (const exp of expenses) {
    if (!Number.isFinite(exp.amount) || exp.amount <= 0) continue;
    const currency = exp.currency || 'INR';
    const payerId = nameToUserId.get(exp.paidBy);
    if (!payerId) continue;

    const shares: { userId: string; amount: number }[] = exp.splitBreakdown?.length
      ? exp.splitBreakdown
      : (() => {
          const participantIds = exp.splitAmong.map(id => (id === 'You' ? currentUserId : id));
          const count = participantIds.length || 1;
          const shareEach = exp.amount / count;
          return participantIds.map(userId => ({ userId, amount: shareEach }));
        })();

    for (const { userId: owerId, amount } of shares) {
      if (owerId === payerId) continue;

      if (payerId === currentUserId && owerId !== currentUserId) {
        const bucket = (result[owerId] ??= {});
        bucket[currency] = (bucket[currency] ?? 0) + amount;
      } else if (owerId === currentUserId && payerId !== currentUserId) {
        const bucket = (result[payerId] ??= {});
        bucket[currency] = (bucket[currency] ?? 0) - amount;
      }
    }
  }

  return result;
}
