import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Debt } from '../../api/trips.api';
import { formatCurrencyCompact } from '../../utils/currency';

type Props = {
  debts: Debt[];
  currentUserId: string;
  onSettle: (toUserId: string, amount: number, currency: string) => void;
  /** Disables settle for the active debt while a settlement is in flight. */
  settlingDebtKey?: string | null;
  styles: {
    expRow: object;
    expName: object;
    expMeta: object;
    tealBtnFull: object;
    tealBtnTxt: object;
  };
};

export default function OutstandingDebtsList({ debts, currentUserId, onSettle, settlingDebtKey, styles: s }: Props) {
  const sortedDebts = useMemo(() => {
    const pending: Debt[] = [];
    const rest: Debt[] = [];
    for (const debt of debts) {
      if (debt.from === currentUserId) pending.push(debt);
      else rest.push(debt);
    }
    return [...pending, ...rest];
  }, [debts, currentUserId]);

  return (
    <View>
      <Text style={local.sectionTitle}>Outstanding</Text>
      {sortedDebts.map((debt, i) => {
        const showSettle = debt.from === currentUserId;
        const debtKey = `${debt.from}|${debt.to}|${debt.currency}`;
        const isSettling = settlingDebtKey === debtKey;
        return (
          <View key={i} style={[s.expRow, { alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.expName}>
                {debt.fromName || 'Someone'} owes {debt.toName || 'Someone'}
              </Text>
              <Text style={s.expMeta} numberOfLines={1}>
                {formatCurrencyCompact(debt.amount, debt.currency)}
              </Text>
            </View>
            {showSettle && (
              <TouchableOpacity
                style={[
                  s.tealBtnFull,
                  { paddingHorizontal: 12, paddingVertical: 6 },
                  (settlingDebtKey != null) && { opacity: isSettling ? 0.6 : 0.4 },
                ]}
                onPress={() => onSettle(debt.to, debt.amount, debt.currency)}
                disabled={settlingDebtKey != null}
                activeOpacity={0.85}>
                <Text style={[s.tealBtnTxt, { fontSize: 12 }]}>{isSettling ? 'Settling…' : 'Settle'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
});
