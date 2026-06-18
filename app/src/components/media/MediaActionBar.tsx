import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import colors from '../../theme/colors';
import { DriveBrandIcon } from '../common/GoogleWorkspaceIcons';

function UploadIcon({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function InfoIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#94a3b8" strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type MediaActionBarProps = {
  onUpload?: () => void;
  onCamera?: () => void;
  onDrive?: () => void;
  uploading?: boolean;
  driveImporting?: boolean;
  disabled?: boolean;
  capTotal?: number | null;
  entityLabel?: 'trip' | 'event';
};

export default function MediaActionBar({
  onUpload,
  onCamera,
  onDrive,
  uploading = false,
  driveImporting = false,
  disabled = false,
  capTotal = null,
  entityLabel = 'trip',
}: MediaActionBarProps) {
  const busy = uploading || driveImporting || disabled;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={onUpload} disabled={busy} activeOpacity={0.85}>
          {uploading ? <ActivityIndicator color={colors.accent} size="small" /> : <UploadIcon />}
          <Text style={styles.btnLabel}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={onCamera} disabled={busy} activeOpacity={0.85}>
          <CameraIcon />
          <Text style={styles.btnLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={onDrive} disabled={busy} activeOpacity={0.85}>
          {driveImporting ? <ActivityIndicator color={colors.accent} size="small" /> : <DriveBrandIcon size={18} />}
          <Text style={styles.btnLabel}>Add from Drive</Text>
        </TouchableOpacity>
      </View>
      {capTotal != null && (
        <View style={styles.infoRow}>
          <InfoIcon />
          <Text style={styles.infoText}>
            You can add up to {capTotal} media files for this {entityLabel}.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
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
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  infoText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
    textAlign: 'center',
  },
});
