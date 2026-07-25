import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import type { CurrencyExpenseTotals } from '../../utils/expenseTotals';
import { formatCurrencyFull } from '../../utils/currency';
import { typeStyle } from '../../theme/typography';

const CHART_SIZE = 92;
const STROKE_WIDTH = 15;
const SEGMENT_GAP = 3;
const MAX_VISIBLE_COLUMNS = 3;
const FALLBACK_SLUG = 'general';
const FALLBACK_LABEL = 'General';
const FALLBACK_COLOR = '#0d9488';

type Segment = { slug: string; label: string; amount: number; color: string };

function withFallback(cur: CurrencyExpenseTotals): Segment[] {
  return cur.categories.length > 0
    ? cur.categories
    : [{ slug: FALLBACK_SLUG, label: FALLBACK_LABEL, amount: cur.groupTotal, color: FALLBACK_COLOR }];
}

function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  const radius = (CHART_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = CHART_SIZE / 2;
  const cy = CHART_SIZE / 2;

  if (total <= 0) {
    return (
      <Svg width={CHART_SIZE} height={CHART_SIZE}>
        <Circle cx={cx} cy={cy} r={radius} stroke="#f1f5f9" strokeWidth={STROKE_WIDTH} fill="none" />
      </Svg>
    );
  }

  let cumulative = 0;
  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      <G rotation={-90} origin={`${cx}, ${cy}`}>
        {segments.map(seg => {
          const frac = seg.amount / total;
          const dash = Math.max(frac * circumference - (segments.length > 1 ? SEGMENT_GAP : 0), 0);
          const offset = -(cumulative * circumference);
          cumulative += frac;
          return (
            <Circle
              key={seg.slug}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={seg.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              fill="none"
            />
          );
        })}
      </G>
    </Svg>
  );
}

type Props = {
  byCurrency: CurrencyExpenseTotals[];
};

/**
 * Donut per currency (up to 3 fit the viewport evenly; more than that scrolls
 * horizontally), with one shared legend below for every category that appears
 * across any of the currencies.
 */
export default function ExpenseCurrencyDonuts({ byCurrency }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeCurrencies = byCurrency.filter(c => c.groupTotal > 0);

  if (activeCurrencies.length === 0) return null;

  const scrollable = activeCurrencies.length > MAX_VISIBLE_COLUMNS;
  const columnWidth = scrollable
    ? (containerWidth > 0 ? containerWidth / MAX_VISIBLE_COLUMNS : 110)
    : undefined;

  const legendItems = (() => {
    const map = new Map<string, { slug: string; label: string; color: string }>();
    for (const cur of activeCurrencies) {
      for (const cat of withFallback(cur)) {
        if (!map.has(cat.slug)) map.set(cat.slug, cat);
      }
    }
    return [...map.values()];
  })();

  const renderColumn = (cur: CurrencyExpenseTotals) => (
    <View key={cur.currency} style={[styles.column, columnWidth ? { width: columnWidth } : { flex: 1 }]}>
      <Text style={styles.currencyCode}>{cur.currency}</Text>
      <Text
        style={styles.currencyTotal}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}>
        {formatCurrencyFull(cur.groupTotal, cur.currency)}
      </Text>
      <View style={styles.chartWrap}>
        <DonutChart segments={withFallback(cur)} total={cur.groupTotal} />
      </View>
    </View>
  );

  return (
    <View style={styles.card} onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal">
          {activeCurrencies.map(renderColumn)}
        </ScrollView>
      ) : (
        <View style={styles.row}>{activeCurrencies.map(renderColumn)}</View>
      )}

      <View style={styles.legend}>
        {legendItems.map(item => (
          <View key={item.slug} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chartWrap: {
    marginTop: 10,
  },
  currencyCode: typeStyle('expSectionHeading', { color: '#0f172a', textAlign: 'center' }),
  currencyTotal: typeStyle('expTotalValue', { color: '#0f172a', marginTop: 2, textAlign: 'center' }),
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 8,
    marginTop: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
});
