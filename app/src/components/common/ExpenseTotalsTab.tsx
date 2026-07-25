import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GroupExpenseTotals, MemberRosterEntry } from '../../utils/expenseTotals';
import { formatCurrencyFull } from '../../utils/currency';
import ExpenseCurrencyDonuts from './ExpenseCurrencyDonuts';
import CachedImage from './CachedImage';
import { typeStyle } from '../../theme/typography';

const EPS = 0.005;
const MAX_VISIBLE_ITEMS = 3;

type Props = {
  totals: GroupExpenseTotals;
  roster: MemberRosterEntry[];
  currentUserId: string;
  /** userId -> currency -> net balance with that member (positive = they owe you). */
  pairwiseBalances: Record<string, Record<string, number>>;
  /** currency -> your overall net balance across the whole group. */
  myBalances: Record<string, number>;
  styles: {
    emptyCenter: object;
    emptyTitle: object;
    emptySub: object;
  };
};

export default function ExpenseTotalsTab({
  totals,
  roster,
  currentUserId,
  pairwiseBalances,
  myBalances,
  styles: s,
}: Props) {
  const { byCurrency } = totals;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const hasExpenses = byCurrency.some(
    c => c.groupTotal > 0 || c.members.some(m => m.shareTotal > 0 || m.paidTotal > 0),
  );

  if (!hasExpenses) {
    return (
      <View style={s.emptyCenter}>
        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"
            stroke="#cbd5e1"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={s.emptyTitle}>No expenses yet</Text>
        <Text style={s.emptySub}>Add expenses to see totals and breakdowns here</Text>
      </View>
    );
  }

  const toggleExpanded = (userId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <View>
      <ExpenseCurrencyDonuts byCurrency={byCurrency} />

      <Text style={local.sectionLabel}>Individual breakdown</Text>

      {roster.map(member => {
        const isYou = member.userId === currentUserId;
        const initial = member.name ? member.name[0].toUpperCase() : '?';
        const isExpanded = expandedIds.has(member.userId);

        const amounts = byCurrency.map(cur => ({
          currency: cur.currency,
          amount: cur.members.find(m => m.userId === member.userId)?.shareTotal ?? 0,
        }));

        const memberBalances = isYou ? myBalances : (pairwiseBalances[member.userId] ?? {});
        const chips = byCurrency
          .map(cur => ({ currency: cur.currency, amount: memberBalances[cur.currency] ?? 0 }))
          .filter(c => Math.abs(c.amount) > EPS);

        const totalHiddenAmounts = amounts.length > MAX_VISIBLE_ITEMS ? amounts.length - MAX_VISIBLE_ITEMS : 0;
        const totalHiddenChips = chips.length > MAX_VISIBLE_ITEMS ? chips.length - MAX_VISIBLE_ITEMS : 0;
        const canExpand = totalHiddenAmounts > 0 || totalHiddenChips > 0;

        const visibleAmounts = isExpanded ? amounts : amounts.slice(0, MAX_VISIBLE_ITEMS);
        const visibleChips = isExpanded ? chips : chips.slice(0, MAX_VISIBLE_ITEMS);

        return (
          <View key={member.userId} style={local.card}>
            <View style={local.avatarBox}>
              {member.avatarUrl ? (
                <CachedImage uri={member.avatarUrl} style={local.avatarImg} resizeMode="cover" priority="normal" />
              ) : (
                <Text style={local.avatarInitial}>{initial}</Text>
              )}
            </View>

            <View style={local.cardBody}>
              <Text style={local.memberName} numberOfLines={1}>
                {member.name}
              </Text>

              <View style={local.amountsRow}>
                {visibleAmounts.map((a, idx) => (
                  <React.Fragment key={a.currency}>
                    {idx > 0 && <Text style={local.amountSep}>·</Text>}
                    <Text style={local.amountText}>{formatCurrencyFull(a.amount, a.currency)}</Text>
                  </React.Fragment>
                ))}
              </View>

              {(visibleChips.length > 0 || canExpand) && (
                <View style={local.chipsRow}>
                  {visibleChips.map(chip => {
                    const isLent = chip.amount > 0;
                    return (
                      <View key={chip.currency} style={[local.chip, isLent ? local.chipLent : local.chipOwe]}>
                        <Text style={[local.chipText, isLent ? local.chipTextLent : local.chipTextOwe]}>
                          {isLent ? 'You lent ' : 'You owe '}
                          {formatCurrencyFull(Math.abs(chip.amount), chip.currency)}
                        </Text>
                      </View>
                    );
                  })}
                  {canExpand && (
                    <TouchableOpacity
                      onPress={() => toggleExpanded(member.userId)}
                      activeOpacity={0.7}
                      style={local.moreChip}>
                      <Text style={[local.moreChipText, isExpanded && local.moreChipTextWord]}>
                        {isExpanded ? 'Show less' : '···'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  sectionLabel: typeStyle('expSectionHeading', { color: '#0f172a', marginBottom: 10 }),
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d9488',
  },
  cardBody: {
    flex: 1,
    marginLeft: 10,
  },
  memberName: typeStyle('expBreakdownRow', { color: '#0d9488', marginBottom: 4 }),
  amountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  amountText: typeStyle('expBreakdownRow', { color: '#0f172a' }),
  amountSep: { fontSize: 12, color: '#64748b' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipLent: {
    backgroundColor: '#f0fdf4',
  },
  chipOwe: {
    backgroundColor: '#fff1f2',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chipTextLent: {
    color: '#16a34a',
  },
  chipTextOwe: {
    color: '#e11d48',
  },
  moreChip: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  moreChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  moreChipTextWord: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0,
  },
});
