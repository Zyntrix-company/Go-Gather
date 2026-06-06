import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CurrencyExpenseTotals } from '../../utils/expenseTotals';
import { formatCurrencyCompact } from '../../utils/currency';

const CURRENCY_COLORS: Record<string, string> = {
  INR: '#0d9488',
  USD: '#2563eb',
  EUR: '#7c3aed',
  GBP: '#db2777',
  AED: '#d97706',
  SGD: '#059669',
  CAD: '#dc2626',
  AUD: '#ea580c',
  JPY: '#475569',
  CHF: '#0891b2',
};

function getCurrencyAccent(code: string): string {
  return CURRENCY_COLORS[code] ?? '#64748b';
}

/** Softer bar fill — keeps hue, lowers visual weight on the track. */
function softenBarColor(hex: string, opacity = 0.38): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

type Props = {
  byCurrency: CurrencyExpenseTotals[];
};

export default function ExpenseDistributionBar({ byCurrency }: Props) {
  const activeCurrencies = byCurrency.filter(c => c.groupTotal > 0);

  if (activeCurrencies.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.currencyList}>
        {activeCurrencies.map(cur => {
          const categories = cur.categories.length > 0
            ? cur.categories
            : [{ slug: 'general', label: 'General', amount: cur.groupTotal, color: getCurrencyAccent(cur.currency) }];

          return (
            <View key={cur.currency} style={styles.currencyBlock}>
              {/* Currency label + total */}
              <View style={styles.currencyHeader}>
                <Text style={styles.currencyCode}>{cur.currency}</Text>
                <Text style={styles.currencyTotal}>{formatCurrencyCompact(cur.groupTotal, cur.currency)}</Text>
              </View>

              {/* Per-currency category bar (full width = 100% of this currency) */}
              <View style={styles.barTrack}>
                {categories.map((cat, catIdx) => {
                  const catFlex = cat.amount / cur.groupTotal;
                  const isFirst = catIdx === 0;
                  const isLast = catIdx === categories.length - 1;
                  return (
                    <View
                      key={`${cur.currency}-${cat.slug}`}
                      style={[
                        styles.categorySegment,
                        { flex: catFlex, backgroundColor: softenBarColor(cat.color) },
                        isFirst && styles.barStart,
                        isLast && styles.barEnd,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 16,
  },
  currencyList: {
    gap: 18,
  },
  currencyBlock: {
    gap: 8,
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  currencyTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  barTrack: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  categorySegment: {
    height: '100%',
    minWidth: 3,
  },
  barStart: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  barEnd: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
});
