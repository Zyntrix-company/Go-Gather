import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from '../common/ExpenseTabSkeleton';

function ChatRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBox width={52} height={52} style={{ borderRadius: 26 }} />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <SkeletonBox height={14} width="55%" />
          <SkeletonBox height={10} width={48} />
        </View>
        <SkeletonBox height={12} width="80%" />
      </View>
    </View>
  );
}

export default function ChatListSkeleton() {
  return (
    <View style={styles.list}>
      {[1, 2, 3, 4, 5].map((i) => (
        <ChatRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  info: { flex: 1, gap: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
