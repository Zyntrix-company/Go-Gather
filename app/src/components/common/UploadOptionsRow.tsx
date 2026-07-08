import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { DriveBrandIcon } from './GoogleWorkspaceIcons';
import colors from '../../theme/colors';

function UploadIcon({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

type UploadOptionsRowProps = {
  onUpload?: () => void;
  onCamera?: () => void;
  onDrive?: () => void;
  uploading?: boolean;
  driveImporting?: boolean;
  disabled?: boolean;
  showDrive?: boolean;
  /** Transparent (outlined) cards instead of the default filled grey. */
  transparent?: boolean;
};

export default function UploadOptionsRow({
  onUpload,
  onCamera,
  onDrive,
  uploading = false,
  driveImporting = false,
  disabled = false,
  showDrive = true,
  transparent = false,
}: UploadOptionsRowProps) {
  const busy = uploading || driveImporting || disabled;
  const btnStyle = [styles.btn, transparent && styles.btnTransparent];

  return (
    <View style={styles.row}>
      <TouchableOpacity style={[btnStyle, busy && styles.btnDisabled]} onPress={onUpload} disabled={busy} activeOpacity={0.85}>
        {uploading ? <ActivityIndicator color={colors.accent} size="small" /> : <UploadIcon />}
        <Text style={styles.btnLabel}>Upload</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[btnStyle, busy && styles.btnDisabled]} onPress={onCamera} disabled={busy} activeOpacity={0.85}>
        <CameraIcon />
        <Text style={styles.btnLabel}>Camera</Text>
      </TouchableOpacity>
      {showDrive && (
        <TouchableOpacity style={[btnStyle, busy && styles.btnDisabled]} onPress={onDrive} disabled={busy} activeOpacity={0.85}>
          {driveImporting ? <ActivityIndicator color={colors.accent} size="small" /> : <DriveBrandIcon size={24} />}
          <Text style={styles.btnLabel}>Drive</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
  },
  btnTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
});
