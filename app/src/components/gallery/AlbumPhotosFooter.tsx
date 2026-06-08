import React from 'react';

import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { albumChromeStyles as acs } from '../../constants/albumPhotosLayout';
import colors from '../../theme/colors';
import { DriveBrandIcon } from '../common/GoogleWorkspaceIcons';

function UploadIcon({ color = '#0d9488' }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon({ color = '#0d9488' }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

type AlbumPhotosFooterProps = {
  viewOnly?: boolean;
  onUpload?: () => void;
  onCamera?: () => void;
  onDrive?: () => void;
  uploading?: boolean;
  driveImporting?: boolean;
  showDrive?: boolean;
  disabled?: boolean;
  /** When true, sits above the app FloatingTabBar (no extra bottom safe-area). */
  aboveTabBar?: boolean;
  /** Glass-style buttons over gradient (Gallery modals). */
  galleryChrome?: boolean;
  /** Teal primary buttons (trip/event dialog). */
  variant?: 'default' | 'primary';
  /** Render below header instead of at bottom. */
  placement?: 'bottom' | 'top';
};

export default function AlbumPhotosFooter({
  viewOnly = false,
  onUpload,
  onCamera,
  onDrive,
  uploading = false,
  driveImporting = false,
  showDrive = true,
  disabled = false,
  aboveTabBar = false,
  galleryChrome = false,
  variant = 'default',
  placement = 'bottom',
}: AlbumPhotosFooterProps) {
  const insets = useSafeAreaInsets();
  const busy = uploading || driveImporting || disabled;
  const bottomPad = aboveTabBar ? 8 : Math.max(insets.bottom, 12);
  const primary = variant === 'primary';
  const iconColor = primary ? colors.accentForeground : '#0d9488';
  const spinnerColor = primary ? colors.accentForeground : '#0d9488';

  if (viewOnly) {
    return null;
  }

  const btn = primary
    ? styles.actionBtnPrimary
    : galleryChrome
      ? acs.actionBtnGallery
      : acs.actionBtn;
  const btnOutline = primary
    ? styles.actionBtnPrimary
    : galleryChrome
      ? acs.actionBtnOutlineGallery
      : acs.actionBtnOutline;
  const btnFull = primary
    ? styles.actionBtnPrimaryFull
    : galleryChrome
      ? acs.actionBtnFullGallery
      : acs.actionBtnFull;
  const btnText = primary ? styles.actionBtnTextPrimary : acs.actionBtnText;

  const content = (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[btn, busy && { opacity: 0.6 }]}
          onPress={onUpload}
          disabled={busy}
          activeOpacity={0.85}
        >
          {uploading ? <ActivityIndicator color={spinnerColor} size="small" /> : <UploadIcon color={iconColor} />}
          <Text style={btnText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[btnOutline, busy && { opacity: 0.6 }]}
          onPress={onCamera}
          disabled={busy}
          activeOpacity={0.85}
        >
          <CameraIcon color={iconColor} />
          <Text style={btnText}>Camera</Text>
        </TouchableOpacity>
      </View>
      {showDrive && onDrive && (
        <TouchableOpacity
          style={[btnFull, busy && { opacity: 0.6 }]}
          onPress={onDrive}
          disabled={busy}
          activeOpacity={0.85}
        >
          {driveImporting ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <>
              <DriveBrandIcon size={16} />
              <Text style={btnText}>Add from Drive</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </>
  );

  if (placement === 'top') {
    return (
      <View style={styles.actionsTop}>
        {content}
      </View>
    );
  }

  return (
    <View style={galleryChrome ? undefined : { backgroundColor: '#fff' }}>
      <View style={[acs.footer, galleryChrome && acs.footerGallery, { paddingBottom: bottomPad }]}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsTop: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    flexShrink: 0,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPrimaryFull: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnTextPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentForeground,
  },
});
