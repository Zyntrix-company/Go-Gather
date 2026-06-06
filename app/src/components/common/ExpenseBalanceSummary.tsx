import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/currency';

const EPS = 0.005;

type CurrencyRow = {
  code: string;
  total: number;
  balance: number;
};

function buildRows(
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
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}

type Props = {
  totalExpensesByCurrency: Record<string, string>;
  myBalances: Record<string, number>;
};

export default function ExpenseBalanceSummary({ totalExpensesByCurrency, myBalances }: Props) {
  const allRows = buildRows(totalExpensesByCurrency, myBalances);
  const totalRows = allRows.filter(row => row.total > EPS);
  const balanceRows = allRows.filter(row => Math.abs(row.balance) > EPS);
  const hasBalanceBlocks = balanceRows.length > 0;

  if (totalRows.length === 0 && !hasBalanceBlocks) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.cardTitle}>Total</Text>
        <Text style={styles.emptyLine}>No expenses yet</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, !hasBalanceBlocks && styles.rowSingle]}>
      <View style={[styles.totalCard, !hasBalanceBlocks && styles.totalCardFull]}>
        <Text style={styles.cardTitle}>Total</Text>
        {totalRows.length > 0 ? (
          <View style={styles.totalLines}>
            {totalRows.map((row, idx) => (
              <View
                key={row.code}
                style={[styles.totalLine, idx < totalRows.length - 1 && styles.totalLineBorder]}>
                <Text style={styles.totalCode}>{row.code}</Text>
                <Text style={styles.totalAmount}>{formatCurrency(row.total, row.code)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyLine}>No group spend recorded</Text>
        )}
      </View>

      {hasBalanceBlocks && (
        <View style={styles.balanceCol}>
          {balanceRows.map(row => {
            const isPositive = row.balance > EPS;
            return (
              <View
                key={row.code}
                style={[
                  styles.balanceBlock,
                  isPositive ? styles.balancePositive : styles.balanceNegative,
                ]}>
                <Text style={styles.balanceLabel}>You</Text>
                <View style={styles.balanceValueRow}>
                  <Text style={[styles.balanceSign, isPositive ? styles.balanceTextPositive : styles.balanceTextNegative]}>
                    {isPositive ? '+' : '−'}
                  </Text>
                  <Text style={[styles.balanceAmount, isPositive ? styles.balanceTextPositive : styles.balanceTextNegative]}>
                    {formatCurrency(Math.abs(row.balance), row.code)}
                  </Text>
                </View>
                <Text style={[styles.balanceCode, isPositive ? styles.balanceTextPositive : styles.balanceTextNegative]}>
                  {row.code}
                </Text>
              </View>
            );
          })}
        </View>
      )}
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
  rowSingle: {
    marginBottom: 18,
  },
  emptyWrap: {
    marginBottom: 18,
    padding: 12,
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  totalCardFull: {
    flex: 1,
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
});
