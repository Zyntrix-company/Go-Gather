import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

/* ─── Shimmer pulse ─────────────────────────────────────────────────────── */
function SkeletonBox({ width, height, style }: { width?: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius: 8, backgroundColor: '#e2e8f0' },
        { opacity },
        style,
      ]}
    />
  );
}

/* ─── Expense tab skeleton ─────────────────────────────────────────────── */
function ExpenseRowSkeleton() {
  return (
    <View style={sk.row}>
      <SkeletonBox width={40} height={40} style={{ borderRadius: 20 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBox height={13} width="65%" />
        <SkeletonBox height={10} width="45%" />
      </View>
      <SkeletonBox width={56} height={16} />
    </View>
  );
}

export function ExpenseListSkeleton() {
  return (
    <View style={{ marginTop: 12 }}>
      {[1, 2, 3, 4].map(i => <ExpenseRowSkeleton key={i} />)}
    </View>
  );
}

/* ─── Total tab skeleton ───────────────────────────────────────────────── */
export function TotalTabSkeleton() {
  return (
    <View style={{ marginTop: 4 }}>
      {/* Group total card */}
      <View style={sk.card}>
        <SkeletonBox height={11} width="45%" />
        <SkeletonBox height={24} width="60%" style={{ marginTop: 10 }} />
        <SkeletonBox height={10} width="30%" style={{ marginTop: 8 }} />
      </View>

      {/* Section label */}
      <SkeletonBox height={12} width="38%" style={{ marginTop: 16, marginBottom: 14 }} />

      {/* Member rows */}
      {[1, 2, 3].map(i => (
        <View key={i} style={sk.memberRow}>
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox height={13} width="50%" />
            <SkeletonBox height={14} width="35%" />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 7 }}>
            <SkeletonBox height={10} width={52} />
            <SkeletonBox height={14} width={52} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Balance tab skeleton ─────────────────────────────────────────────── */
export function BalanceTabSkeleton() {
  return (
    <View style={{ marginTop: 4 }}>
      {/* Two stat cards side-by-side */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[0, 1].map(i => (
          <View key={i} style={[sk.card, { flex: 1 }]}>
            <SkeletonBox height={11} width="60%" />
            <SkeletonBox height={22} width="75%" style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>

      {/* Debt rows */}
      {[1, 2, 3].map(i => (
        <View key={i} style={sk.row}>
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox height={13} width="70%" />
            <SkeletonBox height={11} width="40%" />
          </View>
          <SkeletonBox width={60} height={28} style={{ borderRadius: 6 }} />
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});
