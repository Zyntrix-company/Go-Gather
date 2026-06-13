import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Pen, Archive, Upload } from 'lucide-react-native';
import { albumChromeStyles as acs } from '../../constants/albumPhotosLayout';

const BackIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#0f172a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PinIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke="#94a3b8" strokeWidth={2} />
  </Svg>
);

type GalleryAlbumSubHeaderProps = {
  title: string;
  location?: string | null;
  editMode?: boolean;
  viewOnly?: boolean;
  nameDraft?: string;
  subtitleDraft?: string;
  onNameChange?: (v: string) => void;
  onSubtitleChange?: (v: string) => void;
  onBack: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onUpload?: () => void;
  onDoneEdit?: () => void;
  saving?: boolean;
};

export default function GalleryAlbumSubHeader({
  title,
  location,
  editMode = false,
  viewOnly = false,
  nameDraft = '',
  subtitleDraft = '',
  onNameChange,
  onSubtitleChange,
  onBack,
  onEdit,
  onArchive,
  onUpload,
  onDoneEdit,
  saving = false,
}: GalleryAlbumSubHeaderProps) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack} style={acs.headerBackGallery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <BackIcon />
      </TouchableOpacity>

      <View style={styles.center}>
        {editMode && !viewOnly ? (
          <>
            <TextInput
              value={nameDraft}
              onChangeText={onNameChange}
              style={styles.titleInput}
              placeholder="Trip name"
              placeholderTextColor="#94a3b8"
              returnKeyType="next"
            />
            <TextInput
              value={subtitleDraft}
              onChangeText={onSubtitleChange}
              style={styles.subtitleInput}
              placeholder="Description…"
              placeholderTextColor="#94a3b8"
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={onDoneEdit}
            />
          </>
        ) : (
          <>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {location?.trim() ? (
              <View style={styles.locationRow}>
                <PinIcon />
                <Text style={styles.location} numberOfLines={1}>{location}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {!viewOnly ? (
        <View style={styles.actions}>
          {editMode ? (
            <TouchableOpacity onPress={onDoneEdit} style={acs.heroOverlayBtnLight} disabled={saving}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={onEdit} style={acs.heroOverlayBtnLight} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Pen size={15} color="#0d9488" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onArchive} style={acs.heroOverlayBtnLight} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Archive size={15} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onUpload} style={acs.heroOverlayBtnLight} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Upload size={15} color="#0d9488" />
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.actionsPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 10,
    flexShrink: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d9488',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  subtitleInput: {
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  location: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  actionsPlaceholder: {
    width: 38,
  },
});
