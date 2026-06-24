import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import UploadOptionsRow from '../common/UploadOptionsRow';

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
  return (
    <View style={styles.wrap}>
      <UploadOptionsRow
        onUpload={onUpload}
        onCamera={onCamera}
        onDrive={onDrive}
        uploading={uploading}
        driveImporting={driveImporting}
        disabled={disabled}
      />
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
