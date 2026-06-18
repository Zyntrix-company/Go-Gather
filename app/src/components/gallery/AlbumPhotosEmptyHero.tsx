import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type AlbumEmptyVariant = 'own' | 'friend' | 'simple';
export type AlbumEmptyKind = 'trip' | 'event';

function PolaroidStackIllustration() {
  return (
    <Svg width={88} height={72} viewBox="0 0 88 72" fill="none">
      <Rect x={8} y={14} width={52} height={44} rx={4} fill="#e2e8f0" transform="rotate(-8 34 36)" opacity={0.7} />
      <Rect x={22} y={8} width={52} height={44} rx={4} fill="#ccfbf1" stroke="#99f6e4" strokeWidth={1.5} />
      <Path d="M28 36l8-10 10 12 6-7 8 10" stroke="#0d9488" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={50} cy={22} r={4} fill="#fde68a" />
      <Rect x={34} y={18} width={44} height={36} rx={3} fill="transparent" stroke="#cbd5e1" strokeWidth={1} transform="rotate(10 56 36)" opacity={0.8} />
    </Svg>
  );
}

function FriendEmptyIllustration() {
  return (
    <Svg width={72} height={64} viewBox="0 0 72 64" fill="none">
      <Rect x={14} y={16} width={44} height={34} rx={10} fill="#ccfbf1" opacity={0.85} />
      <Circle cx={36} cy={32} r={10} stroke="#0d9488" strokeWidth={2} />
      <Circle cx={36} cy={32} r={5} fill="#99f6e4" />
      <Rect x={26} y={8} width={20} height={8} rx={4} fill="#5eead4" />
      <Circle cx={18} cy={14} r={3} fill="#fda4af" opacity={0.85} />
      <Circle cx={54} cy={12} r={2.5} fill="#fde68a" opacity={0.9} />
    </Svg>
  );
}

function UploadIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ownEmptyCopy(kind: AlbumEmptyKind, album: string) {
  if (kind === 'event') {
    return {
      eyebrow: 'Event gallery',
      headline: 'No photos yet',
      body: `Add photos from ${album} to remember how the gathering looked and felt.`,
    };
  }
  return {
    eyebrow: 'Trip gallery',
    headline: 'No photos yet',
    body: `Relive ${album} by uploading photos from your completed trip.`,
  };
}

function friendEmptyCopy(kind: AlbumEmptyKind, firstName: string, place: string) {
  const label = kind === 'event' ? 'event' : 'trip';
  return {
    headline: 'No Moments Shared Yet',
    body: `${firstName} hasn't posted any photos from ${place} yet. Check back when memories from this ${label} are added.`,
  };
}

type AlbumPhotosEmptyHeroProps = {
  variant?: AlbumEmptyVariant;
  albumKind?: AlbumEmptyKind;
  albumName?: string;
  friendName?: string;
  locationLabel?: string;
  onUploadPress?: () => void;
  centered?: boolean;
  title?: string;
  subtitle?: string;
  galleryChrome?: boolean;
};

export default function AlbumPhotosEmptyHero({
  variant = 'simple',
  albumKind = 'trip',
  albumName = 'this trip',
  friendName = 'They',
  locationLabel,
  onUploadPress,
  centered = false,
  title = 'No photos yet',
  subtitle,
  galleryChrome = false,
}: AlbumPhotosEmptyHeroProps) {
  const place = locationLabel?.trim() || albumName?.trim() || (albumKind === 'event' ? 'this event' : 'this trip');
  const album = albumName?.trim() || place;

  let content: React.ReactNode;

  if (variant === 'own') {
    const copy = ownEmptyCopy(albumKind, album);
    content = (
      <>
        <View style={styles.illusWrap}>
          <PolaroidStackIllustration />
        </View>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {onUploadPress ? (
          <TouchableOpacity style={styles.uploadBtn} onPress={onUploadPress} activeOpacity={0.88}>
            <UploadIcon />
            <Text style={styles.uploadBtnText}>Upload Photos</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  } else if (variant === 'friend') {
    const firstName = friendName.trim().split(' ')[0] || friendName;
    const copy = friendEmptyCopy(albumKind, firstName, place);
    content = (
      <>
        <View style={styles.illusWrap}>
          <FriendEmptyIllustration />
        </View>
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </>
    );
  } else {
    content = (
      <>
        <Text style={[styles.simpleTitle, galleryChrome && styles.titleGallery]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.simpleSubtitle, galleryChrome && styles.subtitleGallery]}>{subtitle}</Text>
        ) : null}
      </>
    );
  }

  const isRich = variant === 'own' || variant === 'friend';

  return (
    <View style={[styles.root, centered && isRich && styles.rootCentered]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  rootCentered: {
    flex: 1,
    minHeight: 320,
    paddingVertical: 24,
  },
  illusWrap: {
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0d9488',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: '#0f766e',
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  simpleTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
  titleGallery: {
    color: '#0f172a',
  },
  simpleSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  subtitleGallery: {
    color: '#64748b',
  },
});
