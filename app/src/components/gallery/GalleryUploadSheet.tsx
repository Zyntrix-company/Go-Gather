import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { DriveBrandIcon } from '../common/GoogleWorkspaceIcons';

function UploadIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke="#0d9488" strokeWidth={2} />
    </Svg>
  );
}

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Add photos</Text>
          <TouchableOpacity
            style={styles.option}
            onPress={() => { onClose(); onGallery(); }}
            disabled={busy}
            activeOpacity={0.85}
          >
            <UploadIcon />
            <Text style={styles.optionText}>Upload from gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => { onClose(); onCamera(); }}
            disabled={busy}
            activeOpacity={0.85}
          >
            <CameraIcon />
            <Text style={styles.optionText}>Camera</Text>
          </TouchableOpacity>
          {showDrive && onDrive ? (
            <TouchableOpacity
              style={styles.option}
              onPress={() => { onClose(); onDrive(); }}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color="#0d9488" size="small" /> : <DriveBrandIcon size={18} />}
              <Text style={styles.optionText}>Add from Drive</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  optionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
});
