import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GroupExpenseTotals } from '../../utils/expenseTotals';
import { formatCurrency } from '../../utils/currency';

type Props = {
  totals: GroupExpenseTotals;
  styles: {
    emptyCenter: object;
    emptyTitle: object;
    emptySub: object;
    balCard: object;
    balLabel: object;
    balValue: object;
    expRow: object;
    expName: object;
    expMeta: object;
    expAmt: object;
  };
};

export default function ExpenseTotalsTab({ totals, styles: s }: Props) {
  const { byCurrency } = totals;

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
        <Text style={s.emptySub}>Totals will appear once expenses are added</Text>
      </View>
    );
  }

  // Single combined total string: "₹1,200 + $50 + €30"
  const totalSummary = byCurrency
    .filter(c => c.groupTotal > 0)
    .map(c => formatCurrency(c.groupTotal, c.currency))
    .join('  +  ');

  const memberCount = byCurrency[0]?.members.length ?? 0;

  return (
    <View>
      {/* One group total card showing all currencies inline */}
      <View style={[local.groupCard, s.balCard]}>
        <Text style={s.balLabel}>Group total expenditure</Text>
        <Text style={[s.balValue, { fontSize: byCurrency.length > 1 ? 18 : 22 }]}>{totalSummary}</Text>
        <Text style={local.groupHint}>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <Text style={local.sectionLabel}>Individual breakdown</Text>

      {/* Per-currency member rows — no section headers, amounts are self-labelled */}
      {byCurrency.map(({ currency, members }) =>
        members.map(m => (
          <View key={`${m.userId}-${currency}`} style={[s.expRow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.expName}>{m.name}</Text>
              <Text style={[s.expAmt, { marginTop: 4 }]}>{formatCurrency(m.shareTotal, currency)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.expMeta}>Paid out</Text>
              <Text style={[s.expAmt, { color: '#0d9488' }]}>{formatCurrency(m.paidTotal, currency)}</Text>
            </View>
          </View>
        )),
      )}
    </View>
  );
}

const local = StyleSheet.create({
  groupCard: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 14,
  },
  groupHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
});
