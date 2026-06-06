import React from 'react';

import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { albumChromeStyles as acs } from '../../constants/albumPhotosLayout';
import { DriveBrandIcon } from '../common/GoogleWorkspaceIcons';

const UploadIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CameraIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={4} stroke="#0d9488" strokeWidth={2} />
  </Svg>
);

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
}: AlbumPhotosFooterProps) {
  const insets = useSafeAreaInsets();
  const busy = uploading || driveImporting || disabled;
  const bottomPad = aboveTabBar ? 8 : Math.max(insets.bottom, 12);

  const wrap = (content: React.ReactNode) => (
    <View style={{ backgroundColor: '#fff' }}>
      <View style={[acs.footer, { paddingBottom: bottomPad }]}>
        {content}
      </View>
    </View>
  );

  if (viewOnly) {
    return wrap(
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>View only · shared album</Text>,
    );
  }

  return wrap(
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[acs.actionBtn, busy && { opacity: 0.6 }]}
          onPress={onUpload}
          disabled={busy}
          activeOpacity={0.85}
        >
          {uploading ? <ActivityIndicator color="#0d9488" size="small" /> : <UploadIcon />}
          <Text style={acs.actionBtnText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[acs.actionBtnOutline, busy && { opacity: 0.6 }]}
          onPress={onCamera}
          disabled={busy}
          activeOpacity={0.85}
        >
          <CameraIcon />
          <Text style={acs.actionBtnText}>Camera</Text>
        </TouchableOpacity>
      </View>
      {showDrive && onDrive && (
        <TouchableOpacity
          style={[acs.actionBtnFull, busy && { opacity: 0.6 }]}
          onPress={onDrive}
          disabled={busy}
          activeOpacity={0.85}
        >
          {driveImporting ? (
            <ActivityIndicator color="#0d9488" />
          ) : (
            <>
              <DriveBrandIcon size={16} />
              <Text style={acs.actionBtnText}>Add from Drive</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </>,
  );
}
