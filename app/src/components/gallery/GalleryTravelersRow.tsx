import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, PanResponder } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';

export type GalleryTraveler = {
  userId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
};

const MAX_VISIBLE = 5;

// ─── Sliding eye toggle ───────────────────────────────────────────────────────

const TRACK_W = 56;
const TRACK_H = 28;
const THUMB_D = 22;
const POS_HIDDEN = 3;                        // thumb left  = travelers hidden
const POS_VISIBLE = TRACK_W - THUMB_D - 3;  // thumb right = travelers visible

function EyeToggle({
  hidden,
  onToggle,
}: {
  hidden: boolean;
  onToggle: (nowHidden: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(hidden ? POS_HIDDEN : POS_VISIBLE)).current;
  const stateRef = useRef(hidden);
  const dragBase = useRef(0);

  useEffect(() => {
    stateRef.current = hidden;
    Animated.spring(anim, {
      toValue: hidden ? POS_HIDDEN : POS_VISIBLE,
      useNativeDriver: false,
      speed: 24,
      bounciness: 0,
    }).start();
  }, [hidden, anim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 3,
      onPanResponderGrant: () => {
        anim.stopAnimation();
        dragBase.current = stateRef.current ? POS_HIDDEN : POS_VISIBLE;
      },
      onPanResponderMove: (_, { dx }) => {
        anim.setValue(Math.max(POS_HIDDEN, Math.min(POS_VISIBLE, dragBase.current + dx)));
      },
      onPanResponderRelease: (_, { dx }) => {
        let nextHidden = stateRef.current;
        if (dx > 0) nextHidden = false;      // any drag right → visible
        else if (dx < 0) nextHidden = true; // any drag left → hidden

        Animated.spring(anim, {
          toValue: nextHidden ? POS_HIDDEN : POS_VISIBLE,
          useNativeDriver: false,
          speed: 24,
          bounciness: 0,
        }).start();

        if (nextHidden !== stateRef.current) {
          onToggle(nextHidden);
        }
      },
    })
  ).current;

  const trackColor = anim.interpolate({
    inputRange: [POS_HIDDEN, POS_VISIBLE],
    outputRange: ['#e2e8f0', '#ccfbf1'],
  });

  return (
    <Animated.View
      style={[styles.track, { backgroundColor: trackColor }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackIcons} pointerEvents="none">
        <EyeOff size={12} color={hidden ? '#0d9488' : '#94a3b8'} strokeWidth={2} />
        <Eye size={12} color={!hidden ? '#0d9488' : '#94a3b8'} strokeWidth={2} />
      </View>
      <Animated.View style={[styles.thumb, { left: anim }]}> 
        {hidden
          ? <EyeOff size={13} color="#64748b" strokeWidth={2} />
          : <Eye size={13} color="#0d9488" strokeWidth={2} />}
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type GalleryTravelersRowProps = {
  members: GalleryTraveler[];
  editMode?: boolean;
  travelersHidden?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
};

function TravelerAvatar({ member, idx }: { member: GalleryTraveler; idx: number }) {
  return (
    <View style={[styles.avatarWrap, idx > 0 && styles.avatarOverlap]}>
      {member.avatarUrl ? (
        <CachedImage uri={member.avatarUrl} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.initial}>{(member.fullName ?? '?')[0]?.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

export default function GalleryTravelersRow({
  members,
  editMode = false,
  travelersHidden = false,
  onToggleVisibility,
}: GalleryTravelersRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (members.length === 0) return null;

  const dimmed = editMode && travelersHidden;
  const extra = members.length - MAX_VISIBLE;
  const showExpand = !expanded && extra > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Travelers in this trip</Text>
      <View style={styles.row}>
        {expanded ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.avatarScroll, dimmed && styles.dimmed]}
            contentContainerStyle={styles.avatarScrollContent}
          >
            {members.map((m, idx) => (
              <TravelerAvatar key={m.userId} member={m} idx={idx} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.avatarRow, dimmed && styles.dimmed]}>
            {members.slice(0, MAX_VISIBLE).map((m, idx) => (
              <TravelerAvatar key={m.userId} member={m} idx={idx} />
            ))}
            {showExpand && (
              <TouchableOpacity
                style={[styles.avatarWrap, styles.avatarOverlap, styles.moreBadge]}
                onPress={() => setExpanded(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.moreText}>+{extra}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {editMode && onToggleVisibility ? (
          <EyeToggle
            hidden={travelersHidden}
            onToggle={(nowHidden) => onToggleVisibility(!nowHidden)}
          />
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR = 30;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: AVATAR,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
  },
  avatarScroll: {
    flex: 1,
    flexShrink: 1,
  },
  avatarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  dimmed: {
    opacity: 0.35,
  },
  // Sliding toggle
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    marginLeft: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_D,
    height: THUMB_D,
    borderRadius: THUMB_D / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  trackIcons: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // Avatar styles
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
