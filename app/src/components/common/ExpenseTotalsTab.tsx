import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GroupExpenseTotals } from '../../utils/expenseTotals';
import { formatCurrencyFull } from '../../utils/currency';
import ExpenseDistributionBar from './ExpenseDistributionBar';

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

  return (
    <View>
      <View style={local.groupCard}>
        <ExpenseDistributionBar byCurrency={byCurrency} />
      </View>

      <Text style={local.sectionLabel}>Individual breakdown</Text>

      {/* Per-currency member rows — no section headers, amounts are self-labelled */}
      {byCurrency.map(({ currency, members }) =>
        members.map(m => (
          <View key={`${m.userId}-${currency}`} style={[s.expRow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.expName}>{m.name}</Text>
              <Text
                style={[s.expAmt, { marginTop: 4 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {formatCurrencyFull(m.shareTotal, currency)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '48%' }}>
              <Text style={s.expMeta}>Paid out</Text>
              <Text
                style={[s.expAmt, { color: '#0d9488' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {formatCurrencyFull(m.paidTotal, currency)}
              </Text>
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
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
});
