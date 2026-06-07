import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import type { DriveFile } from '../../api/trips.api';

type Props = {
  file: DriveFile;
  selected: boolean;
  onToggle: () => void;
  showThumbnail?: boolean;
};

function SelectionBox({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </View>
  );
}

function PreviewImage({ uri }: { uri: string | null | undefined }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={styles.previewFallback}>
        <ImageIcon size={18} color="#94a3b8" />
      </View>
    );
  }

  return (
    <CachedImage
      uri={uri}
      style={styles.preview}
      resizeMode="cover"
      priority="normal"
      onError={() => setFailed(true)}
    />
  );
}

export default function DrivePickerRow({ file, selected, onToggle, showThumbnail = true }: Props) {
  const previewUri = showThumbnail ? (file.thumbnailUrl ?? file.iconUrl) : file.iconUrl;

  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      {showThumbnail || file.iconUrl ? (
        <PreviewImage uri={previewUri} />
      ) : null}
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
        <Text style={styles.subtitle}>
          {file.sizeBytes ? `${Math.round(file.sizeBytes / 1024)} KB · ` : ''}
          {new Date(file.modifiedTime).toLocaleDateString()}
        </Text>
      </View>
      <SelectionBox selected={selected} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  preview: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  previewFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#0d9488',
    backgroundColor: '#0d9488',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
