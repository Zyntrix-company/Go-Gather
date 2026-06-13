import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CachedImage from '../common/CachedImage';

export type GalleryTraveler = {
  userId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
};

const MAX_VISIBLE = 3;

type GalleryTravelersRowProps = {
  members: GalleryTraveler[];
};

export default function GalleryTravelersRow({ members }: GalleryTravelersRowProps) {
  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE);
  const extra = members.length - MAX_VISIBLE;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Travelers in this trip</Text>
      <View style={styles.avatarRow}>
        {visible.map((m, idx) => (
          <View key={m.userId} style={[styles.avatarWrap, idx > 0 && styles.avatarOverlap]}>
            {m.avatarUrl ? (
              <CachedImage uri={m.avatarUrl} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.initial}>{(m.fullName ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
          </View>
        ))}
        {extra > 0 ? (
          <View style={[styles.avatarWrap, styles.avatarOverlap, styles.moreBadge]}>
            <Text style={styles.moreText}>+{extra}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const AVATAR = 36;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdfa',
  },
  initial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d9488',
  },
  moreBadge: {
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },
});
