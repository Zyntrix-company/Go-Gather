import React from 'react';
import { View, StyleSheet } from 'react-native';
import UploadOptionsRow from '../common/UploadOptionsRow';
import UploadLimitNote from '../common/UploadLimitNote';

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
        <UploadLimitNote text={`You can add up to ${capTotal} media files for this ${entityLabel}.`} />
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
});
