import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Keyboard, Modal, Pressable, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Pen, Archive, Trash2, Upload, MoreVertical } from 'lucide-react-native';
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
  onNameChange?: (v: string) => void;
  onBack: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
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
  onNameChange,
  onBack,
  onEdit,
  onArchive,
  onDelete,
  onUpload,
  onDoneEdit,
  saving = false,
}: GalleryAlbumSubHeaderProps) {
  const menuAnchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const openMenu = () => {
    menuAnchorRef.current?.measureInWindow((x, y, w, h) => {
      const { width: sw } = Dimensions.get('window');
      setMenuPos({ top: y + h + 6, right: sw - (x + w) });
      setMenuOpen(true);
    });
  };

  const runAction = (fn?: () => void) => {
    setMenuOpen(false);
    fn?.();
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); onBack(); }} style={acs.headerBackGallery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
        <BackIcon />
      </TouchableOpacity>

      <View style={styles.center}>
        {editMode && !viewOnly ? (
          <>
            <TextInput
              value={nameDraft}
              onChangeText={onNameChange}
              style={styles.titleInput}
              placeholder="Name"
              placeholderTextColor="#94a3b8"
              returnKeyType="done"
              onSubmitEditing={onDoneEdit}
            />
          </>
        ) : (
          <>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
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
            <TouchableOpacity onPress={onDoneEdit} style={acs.heroOverlayBtnLight} disabled={saving} activeOpacity={0.7}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <View ref={menuAnchorRef}>
              <TouchableOpacity onPress={openMenu} style={acs.heroOverlayBtnLight} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} activeOpacity={0.7}>
                <MoreVertical size={17} color="#0d9488" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.actionsPlaceholder} />
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, menuPos ? { top: menuPos.top, right: menuPos.right } : styles.menuSheetFallback]}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.8} onPress={() => runAction(onEdit)}>
              <Pen size={15} color="#64748b" strokeWidth={2} />
              <Text style={styles.menuText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} activeOpacity={0.8} onPress={() => runAction(onUpload)}>
              <Upload size={15} color="#64748b" strokeWidth={2} />
              <Text style={styles.menuText}>Upload</Text>
            </TouchableOpacity>
            {onArchive ? (
              <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} activeOpacity={0.8} onPress={() => runAction(onArchive)}>
                <Archive size={15} color="#64748b" strokeWidth={2} />
                <Text style={styles.menuText}>Archive</Text>
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} activeOpacity={0.8} onPress={() => runAction(onDelete)}>
                <Trash2 size={15} color="#ef4444" strokeWidth={2} />
                <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 10,
    flexShrink: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d9488',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d9488',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  location: {
    fontSize: 12,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuSheet: {
    position: 'absolute',
    width: 148,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 6,
  },
  menuSheetFallback: {
    top: 64,
    right: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  menuTextDanger: {
    color: '#ef4444',
  },
});
