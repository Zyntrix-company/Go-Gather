import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from '../common/ExpenseTabSkeleton';
import {
  ALBUM_DIALOG_HERO_H,
  ALBUM_HERO_H_PAD,
  ALBUM_HERO_RADIUS,
  ALBUM_THUMB_H,
  ALBUM_THUMB_W,
  albumChromeStyles as acs,
} from '../../constants/albumPhotosLayout';

const THUMB_GAP = 6;
const THUMB_COUNT = 5;

/** Shimmer placeholder while trip/event photos load from the API. */
export default function AlbumPhotosDialogSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.heroArea}>
        <SkeletonBox
          height={ALBUM_DIALOG_HERO_H - 10}
          style={styles.heroSkeleton}
        />
      </View>

      <View style={acs.thumbStrip}>
        <View style={styles.thumbRow}>
          {Array.from({ length: THUMB_COUNT }, (_, i) => (
            <SkeletonBox
              key={i}
              width={ALBUM_THUMB_W}
              height={ALBUM_THUMB_H}
              style={styles.thumbSkeleton}
            />
          ))}
        </View>
      </View>

      <View style={acs.metaCard}>
        <SkeletonBox height={16} width="55%" style={{ marginBottom: 10 }} />
        <View style={styles.metaRow}>
          <SkeletonBox height={12} width="32%" />
          <SkeletonBox height={12} width="28%" />
          <SkeletonBox height={12} width="18%" />
        </View>
        <View style={styles.membersRow}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBox
              key={i}
              width={22}
              height={22}
              style={[styles.avatarSkeleton, i === 0 && { marginLeft: 0 }]}
            />
          ))}
          <SkeletonBox height={10} width={64} style={{ marginLeft: 6 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 1,
  },
  heroArea: {
    height: ALBUM_DIALOG_HERO_H,
    paddingHorizontal: ALBUM_HERO_H_PAD,
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: '#f1f5f9',
  },
  heroSkeleton: {
    flex: 1,
    borderRadius: ALBUM_HERO_RADIUS,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: THUMB_GAP,
    paddingHorizontal: 12,
  },
  thumbSkeleton: {
    borderRadius: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatarSkeleton: {
    borderRadius: 11,
    marginLeft: -8,
  },
});
