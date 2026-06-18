import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatCurrencyFull, formatSignedCurrencyFull } from '../../utils/currency';
import { typeStyle } from '../../theme/typography';

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
        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"
            stroke="#cbd5e1"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.emptyLine}>No expenses yet</Text>
        <Text style={styles.emptySubLine}>Add expenses to see totals and breakdowns here</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total</Text>
        {totalRows.length > 0 ? (
          <View>
            {totalRows.map((row, idx) => (
              <View
                key={row.code}
                style={[styles.line, idx < totalRows.length - 1 && styles.lineBorder]}>
                <Text style={styles.lineCode}>{row.code}</Text>
                <Text
                  style={styles.lineAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}>
                  {formatCurrencyFull(row.total, row.code)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyLine}>No group spend recorded</Text>
        )}
      </View>

      {hasBalanceBlocks && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>You</Text>
          <View>
            {balanceRows.map((row, idx) => {
              const isPositive = row.balance > EPS;
              const textColor = isPositive ? styles.textPositive : styles.textNegative;
              const bgStyle = isPositive ? styles.linePositive : styles.lineNegative;
              return (
                <View
                  key={row.code}
                  style={[
                    styles.line,
                    bgStyle,
                    idx < balanceRows.length - 1 && styles.lineBorder,
                  ]}>
                  <Text style={[styles.lineCode, textColor]}>{row.code}</Text>
                  <Text
                    style={[styles.lineAmount, textColor]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}>
                    {formatSignedCurrencyFull(row.balance, row.code)}
                  </Text>
                </View>
              );
            })}
          </View>
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
    alignItems: 'flex-start',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    gap: 6,
  },
  lineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  linePositive: {
    backgroundColor: '#f0fdf4',
  },
  lineNegative: {
    backgroundColor: '#fff1f2',
  },
  lineCode: typeStyle('expTotalValue', { color: '#475569', width: 32, flexShrink: 0 }),
  lineAmount: typeStyle('expTotalValue', {
    color: '#0f172a',
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  }),
  emptyLine: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  emptySubLine: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  textPositive: {
    color: '#16a34a',
  },
  textNegative: {
    color: '#e11d48',
  },
});
