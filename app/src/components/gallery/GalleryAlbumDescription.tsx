import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import {
  GALLERY_ALBUM_DESCRIPTION_MAX,
  GALLERY_ALBUM_DESCRIPTION_PLACEHOLDER,
} from '../../constants/albumPhotosLayout';

type GalleryAlbumDescriptionProps = {
  value: string;
  editMode?: boolean;
  onChange?: (text: string) => void;
};

export default function GalleryAlbumDescription({
  value,
  editMode = false,
  onChange,
}: GalleryAlbumDescriptionProps) {
  // Only show saved caption when photos exist (never the empty placeholder).
  const trimmed = value.trim();
  if (!editMode && !trimmed) return null;

  if (editMode) {
    return (
      <View style={styles.wrap}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange?.(t.slice(0, GALLERY_ALBUM_DESCRIPTION_MAX))}
          placeholder={GALLERY_ALBUM_DESCRIPTION_PLACEHOLDER}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          maxLength={GALLERY_ALBUM_DESCRIPTION_MAX}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.text} numberOfLines={2}>
        {trimmed}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    flexShrink: 0,
  },
  text: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748b',
    lineHeight: 20,
  },
  input: {
    fontSize: 13,
    fontWeight: '400',
    color: '#334155',
    lineHeight: 20,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    minHeight: 20,
    maxHeight: 44,
  },
});
