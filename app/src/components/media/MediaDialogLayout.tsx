import React, { useCallback, useState } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import DetailDialogHeader from '../details/DetailDialogHeader';
import MediaDialogScrollContext from './mediaDialogScrollContext';

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
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const [isSorting, setIsSorting] = useState(false);

  const onSectionDragStart = useCallback(() => {
    setIsSorting(true);
  }, []);

  const onSectionDragEnd = useCallback(() => {
    setIsSorting(false);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight }]}>
            <DetailDialogHeader
              title="Media"
              subtitle={loading ? undefined : buildCounterSubtitle(mediaCount, capTotal)}
              onClose={onClose}
            />
            {actions}
            <MediaDialogScrollContext.Provider
              value={{ scrollableRef, onSectionDragStart, onSectionDragEnd }}
            >
              <Animated.ScrollView
                ref={scrollableRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!isSorting}
                nestedScrollEnabled
              >
                {children}
              </Animated.ScrollView>
            </MediaDialogScrollContext.Provider>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
});
