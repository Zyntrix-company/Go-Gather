import React from 'react';
import { View, Modal, ScrollView, StyleSheet } from 'react-native';
import DetailDialogHeader from '../details/DetailDialogHeader';

type MediaDialogLayoutProps = {
  visible: boolean;
  onClose: () => void;
  mediaCount: number;
  capTotal?: number | null;
  loading?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: `${number}%` | number;
};

function buildCounterSubtitle(count: number, capTotal?: number | null): string | undefined {
  if (capTotal != null) return `${count}/${capTotal}`;
  if (count > 0) return `${count}`;
  return undefined;
}

export default function MediaDialogLayout({
  visible,
  onClose,
  mediaCount,
  capTotal = null,
  loading = false,
  actions,
  children,
  maxHeight = '85%',
}: MediaDialogLayoutProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { maxHeight }]}>
          <DetailDialogHeader
            title="Media"
            subtitle={loading ? undefined : buildCounterSubtitle(mediaCount, capTotal)}
            onClose={onClose}
          />
          {actions}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialog: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    width: '100%',
    overflow: 'hidden',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
});
