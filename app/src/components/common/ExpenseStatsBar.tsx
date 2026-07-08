import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrencyFull } from '../../utils/currency';

const EPS = 0.005;

type CurrencyAmount = { code: string; amount: number };

function buildRows(
  totalExpensesByCurrency: Record<string, string>,
  myBalances: Record<string, number>,
): { totalRows: CurrencyAmount[]; oweRows: CurrencyAmount[]; receiveRows: CurrencyAmount[] } {
  const codes = [...new Set([
    ...Object.keys(totalExpensesByCurrency),
    ...Object.keys(myBalances),
  ])];

  const totalRows = codes
    .map(code => ({ code, amount: parseFloat(totalExpensesByCurrency[code] ?? '0') || 0 }))
    .filter(r => r.amount > EPS)
    .sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code));

  const oweRows = codes
    .map(code => ({ code, amount: -(myBalances[code] ?? 0) }))
    .filter(r => r.amount > EPS)
    .sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code));

  const receiveRows = codes
    .map(code => ({ code, amount: myBalances[code] ?? 0 }))
    .filter(r => r.amount > EPS)
    .sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code));

  return { totalRows, oweRows, receiveRows };
}

function StatColumn({
  label,
  rows,
  fallbackCurrency,
  valueColor,
  bordered,
}: {
  label: string;
  rows: CurrencyAmount[];
  fallbackCurrency: string;
  valueColor: string;
  bordered?: boolean;
}) {
  const displayRows = rows.length > 0 ? rows : [{ code: fallbackCurrency, amount: 0 }];
  const showCode = rows.length > 1;

  return (
    <View style={[styles.col, bordered && styles.colBorder]}>
      <Text style={styles.colLabel}>{label}</Text>
      <View style={styles.colValues}>
        {displayRows.map(row => (
          <View key={row.code} style={styles.colValueRow}>
            {showCode && <Text style={[styles.colCode, { color: valueColor }]}>{row.code}</Text>}
            <Text
              style={[styles.colValue, { color: valueColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrencyFull(row.amount, row.code)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type Props = {
  totalExpensesByCurrency: Record<string, string>;
  myBalances: Record<string, number>;
};

export default function ExpenseStatsBar({ totalExpensesByCurrency, myBalances }: Props) {
  const { totalRows, oweRows, receiveRows } = buildRows(totalExpensesByCurrency, myBalances);
  const fallbackCurrency = totalRows[0]?.code ?? 'INR';

  return (
    <View style={styles.wrap}>
      <StatColumn
        label="Total Expenditure"
        rows={totalRows}
        fallbackCurrency={fallbackCurrency}
        valueColor="#0f172a"
      />
      <StatColumn
        label="You owe"
        rows={oweRows}
        fallbackCurrency={fallbackCurrency}
        valueColor="#ef4444"
        bordered
      />
      <StatColumn
        label="You'll receive"
        rows={receiveRows}
        fallbackCurrency={fallbackCurrency}
        valueColor="#16a34a"
        bordered
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    marginBottom: 14,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  colBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  colLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  colValues: {
    alignItems: 'center',
    gap: 3,
  },
  colValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  colCode: {
    fontSize: 10,
    fontWeight: '600',
  },
  colValue: {
    fontSize: 15,
    fontWeight: '500',
  },
});
