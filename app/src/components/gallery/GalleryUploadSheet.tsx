import React, { useRef } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import AppModal from '../common/AppModal';
import DetailDialogHeader from '../details/DetailDialogHeader';
import UploadOptionsRow from '../common/UploadOptionsRow';

type GalleryUploadSheetProps = {
  visible: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onDrive?: () => void;
  showDrive?: boolean;
  busy?: boolean;
};

export default function GalleryUploadSheet({
  visible,
  onClose,
  onGallery,
  onCamera,
  onDrive,
  showDrive = true,
  busy = false,
}: GalleryUploadSheetProps) {
  // iOS cannot present the image picker while this sheet is still animating
  // out — the picker silently never opens. Hold the action until the sheet has
  // fully dismissed there; Android can launch straight away.
  const pendingRef = useRef<(() => void) | null>(null);

  const run = (fn: () => void) => {
    if (Platform.OS === 'ios') {
      pendingRef.current = fn;
      onClose();
      // Fallback in case onDismiss never fires.
      setTimeout(handleDismiss, 600);
      return;
    }
    onClose();
    fn();
  };

  const handleDismiss = () => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  };

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={handleDismiss}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.dialog}>
          <DetailDialogHeader
            title="Add media"
            subtitle="Add photos and videos to capture your memories."
            onClose={onClose}
          />
          <View style={styles.content}>
            <UploadOptionsRow
              onUpload={() => run(onGallery)}
              onCamera={() => run(onCamera)}
              onDrive={onDrive ? () => run(onDrive!) : undefined}
              driveImporting={busy}
              disabled={busy}
              showDrive={showDrive && !!onDrive}
            />
          </View>
        </View>
      </View>
    </AppModal>
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
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
});
