import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GroupExpenseTotals } from '../../utils/expenseTotals';

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
  const { groupTotal, members } = totals;

  if (groupTotal <= 0 && members.every(m => m.shareTotal <= 0 && m.paidTotal <= 0)) {
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
      <View style={[local.groupCard, s.balCard]}>
        <Text style={s.balLabel}>Group total expenditure</Text>
        <Text style={[s.balValue, { fontSize: 22 }]}>₹{groupTotal.toFixed(2)}</Text>
        <Text style={local.groupHint}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
      </View>

      <Text style={local.sectionLabel}>Individual breakdown</Text>

      {members.map(m => (
        <View key={m.userId} style={[s.expRow, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.expName}>{m.name}</Text>
            <Text style={s.expMeta}>Share of group spend</Text>
            <Text style={[s.expAmt, { marginTop: 4 }]}>₹{m.shareTotal.toFixed(2)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.expMeta}>Paid out</Text>
            <Text style={[s.expAmt, { color: '#0d9488' }]}>₹{m.paidTotal.toFixed(2)}</Text>
          </View>
        </View>
      ))}
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
