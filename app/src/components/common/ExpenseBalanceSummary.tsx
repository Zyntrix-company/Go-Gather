import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { formatCurrencyFull } from '../../utils/currency';

const EPS = 0.005;

type Props = {
  myBalances: Record<string, number>;
};

/** "You'll receive" / "You'll pay" summary cards, one per side, each currency joined inline. */
export default function ExpenseBalanceSummary({ myBalances }: Props) {
  const entries = Object.entries(myBalances)
    .map(([code, amount]) => ({ code, amount }))
    .filter(e => Math.abs(e.amount) > EPS)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const receive = entries.filter(e => e.amount > 0);
  const pay = entries.filter(e => e.amount < 0);

  if (receive.length === 0 && pay.length === 0) return null;

  return (
    <View style={styles.row}>
      {receive.length > 0 && (
        <View style={[styles.card, styles.cardReceive]}>
          <View style={[styles.iconCircle, styles.iconCircleReceive]}>
            <ArrowDown size={16} color="#16a34a" strokeWidth={2.4} />
          </View>
          <Text style={[styles.cardTitle, styles.textReceive]}>You'll receive</Text>
          <Text
            style={[styles.cardAmount, styles.textReceive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {receive.map(e => formatCurrencyFull(e.amount, e.code)).join('  ·  ')}
          </Text>
        </View>
      )}

      {pay.length > 0 && (
        <View style={[styles.card, styles.cardPay]}>
          <View style={[styles.iconCircle, styles.iconCirclePay]}>
            <ArrowUp size={16} color="#e11d48" strokeWidth={2.4} />
          </View>
          <Text style={[styles.cardTitle, styles.textPay]}>You'll pay</Text>
          <Text
            style={[styles.cardAmount, styles.textPay]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {pay.map(e => formatCurrencyFull(Math.abs(e.amount), e.code)).join('  ·  ')}
          </Text>
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
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    padding: 14,
  },
  cardReceive: {
    backgroundColor: '#f0fdf4',
  },
  cardPay: {
    backgroundColor: '#fff1f2',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCircleReceive: {
    borderColor: '#16a34a',
  },
  iconCirclePay: {
    borderColor: '#e11d48',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  textReceive: {
    color: '#16a34a',
  },
  textPay: {
    color: '#e11d48',
  },
});
