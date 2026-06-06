import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/currency';

type CurrencyRow = {
  code: string;
  total: number;
  balance: number;
};

function buildCurrencyRows(
  totalExpensesByCurrency: Record<string, string>,
  myBalances: Record<string, number>,
): CurrencyRow[] {
  const codes = new Set([
    ...Object.keys(totalExpensesByCurrency),
    ...Object.keys(myBalances),
  ]);

  return [...codes]
    .map(code => ({
      code,
      total: parseFloat(totalExpensesByCurrency[code] ?? '0') || 0,
      balance: myBalances[code] ?? 0,
    }))
    .filter(row => row.total > 0 || Math.abs(row.balance) > 0.005)
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}

type Props = {
  totalExpensesByCurrency: Record<string, string>;
  myBalances: Record<string, number>;
};

export default function ExpenseBalanceSummary({ totalExpensesByCurrency, myBalances }: Props) {
  const rows = buildCurrencyRows(totalExpensesByCurrency, myBalances);

  if (rows.length === 0) {
    return (
      <View style={styles.row}>
        <View style={[styles.totalCard, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Total</Text>
          <Text style={styles.emptyLine}>No expenses yet</Text>
        </View>
        <View style={[styles.balanceCol, { flex: 1 }]}>
          <View style={[styles.balanceBlock, styles.balanceSettled]}>
            <Text style={styles.balanceSign}>±</Text>
            <Text style={styles.balanceAmount}>0</Text>
            <Text style={styles.balanceCode}>—</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {/* Left — one total card, all currencies stacked */}
      <View style={styles.totalCard}>
        <Text style={styles.cardTitle}>Total</Text>
        <View style={styles.totalLines}>
          {rows.map((row, idx) => (
            <View
              key={row.code}
              style={[styles.totalLine, idx < rows.length - 1 && styles.totalLineBorder]}>
              <Text style={styles.totalCode}>{row.code}</Text>
              <Text style={styles.totalAmount}>
                {row.total > 0 ? formatCurrency(row.total, row.code) : '—'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Right — one balance block per currency */}
      <View style={styles.balanceCol}>
        {rows.map(row => {
          const isPositive = row.balance > 0.005;
          const isNegative = row.balance < -0.005;
          const blockStyle = isPositive
            ? styles.balancePositive
            : isNegative
              ? styles.balanceNegative
              : styles.balanceSettled;
          const textStyle = isPositive
            ? styles.balanceTextPositive
            : isNegative
              ? styles.balanceTextNegative
              : styles.balanceTextSettled;

          return (
            <View key={row.code} style={[styles.balanceBlock, blockStyle]}>
              <Text style={styles.balanceLabel}>You</Text>
              <View style={styles.balanceValueRow}>
                <Text style={[styles.balanceSign, textStyle]}>
                  {isPositive ? '+' : isNegative ? '−' : '±'}
                </Text>
                <Text style={[styles.balanceAmount, textStyle]}>
                  {Math.abs(row.balance) > 0.005
                    ? formatCurrency(Math.abs(row.balance), row.code)
                    : '0'}
                </Text>
              </View>
              <Text style={[styles.balanceCode, textStyle]}>{row.code}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    alignItems: 'stretch',
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  totalLines: {
    gap: 0,
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  totalCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    width: 36,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  emptyLine: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  balanceCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-start',
  },
  balanceBlock: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  balancePositive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  balanceNegative: {
    backgroundColor: '#fff1f2',
    borderColor: '#fda4af',
  },
  balanceSettled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  balanceSign: {
    fontSize: 16,
    fontWeight: '700',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceCode: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.85,
  },
  balanceTextPositive: {
    color: '#16a34a',
  },
  balanceTextNegative: {
    color: '#e11d48',
  },
  balanceTextSettled: {
    color: '#64748b',
  },
});
