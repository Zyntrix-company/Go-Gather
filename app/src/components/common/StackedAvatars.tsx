import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarInput = { id?: string; uri: string } | string;

export interface StackedAvatarsProps {
  /** Array of avatar objects or plain URI strings */
  avatars: AvatarInput[];
  /**
   * True total member count (including those without avatar URIs).
   * Falls back to avatars.length when omitted.
   */
  totalCount?: number;
  /** Max avatars to show before collapsing into +N. Default: 4 */
  maxVisible?: number;
  /** Avatar diameter in dp. Default: 26 */
  size?: number;
  /** How many dp each avatar overlaps the previous one. Default: 8 */
  overlap?: number;
  /** Whether to render the +N counter bubble. Default: true */
  showCounter?: boolean;
  /**
   * solid → filled teal bg, white text  (good on dark/image overlays)
   * soft  → light teal bg, teal text    (good on white card backgrounds)
   */
  counterStyle?: 'solid' | 'soft';
  /** Stagger fade+slide animation on mount. Default: true */
  animated?: boolean;
  containerStyle?: ViewStyle;
}

// ─── Fallback palette — used when an image fails to load ──────────────────────
const FALLBACK_COLORS = ['#0d9488', '#0891b2', '#7c3aed', '#db2777', '#f97316'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(a: AvatarInput): { id: string; uri: string } {
  if (typeof a === 'string') return { id: a, uri: a };
  return { id: a.id ?? a.uri, uri: a.uri };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single avatar: tries to load the photo, falls back to a coloured circle */
function AvatarCircle({ uri, size, index }: { uri: string; size: number; index: number }) {
  const [failed, setFailed] = useState(false);
  const r = size / 2;

  if (failed) {
    return (
      <View
        style={[
          st.circle,
          { width: size, height: size, borderRadius: r, backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length] },
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[st.circle, { width: size, height: size, borderRadius: r }]}
      onError={() => setFailed(true)}
    />
  );
}

// Pre-allocate 5 animation slots: max 4 avatars + 1 counter bubble.
const POOL_SIZE = 5;

// ─── Main component ───────────────────────────────────────────────────────────

export default function StackedAvatars({
  avatars,
  totalCount,
  maxVisible = 4,
  size = 26,
  overlap = 8,
  showCounter = true,
  counterStyle = 'solid',
  animated: useAnim = true,
  containerStyle,
}: StackedAvatarsProps) {
  // ─── Derived data ─────────────────────────────────────────────────────────
  const all = avatars.map(normalize).filter(a => a.uri.length > 0);
  const total = totalCount ?? all.length;
  const visibleCount = Math.min(maxVisible, all.length);
  const visible = all.slice(0, visibleCount);
  const extra = Math.max(0, total - visibleCount);
  const onlyCounter = visible.length === 0 && extra > 0;
  const hasContent = visible.length > 0 || extra > 0;
  const slotCount = !hasContent ? 0 : onlyCounter ? 1 : visible.length + (showCounter && extra > 0 ? 1 : 0);

  // ─── Hooks — ALWAYS called before any early return ────────────────────────
  const pool = useRef(
    Array.from({ length: POOL_SIZE }, () => ({
      opacity: new Animated.Value(useAnim ? 0 : 1),
      tx: new Animated.Value(useAnim ? 10 : 0),
    })),
  ).current;

  useEffect(() => {
    if (!useAnim || slotCount === 0) return;
    pool.slice(0, slotCount).forEach(slot => {
      slot.opacity.setValue(0);
      slot.tx.setValue(10);
    });
    const animations = pool.slice(0, slotCount).map(slot =>
      Animated.parallel([
        Animated.timing(slot.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slot.tx,      { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    );
    Animated.stagger(50, animations).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotCount]);

  // ─── Early return AFTER all hooks ─────────────────────────────────────────
  if (!hasContent) return null;

  const r = size / 2;
  const isSolid = counterStyle === 'solid';
  const counterBg    = isSolid ? '#0d9488' : '#E8F8F8';
  const counterColor = isSolid ? '#fff'    : '#0d9488';
  const counterFontSize = Math.max(7, Math.round(size * 0.34));

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderAvatar = (av: { id: string; uri: string }, i: number) => (
    <Animated.View
      key={av.id}
      style={{
        opacity: pool[i].opacity,
        transform: [{ translateX: pool[i].tx }],
        marginLeft: i === 0 ? 0 : -overlap,
        zIndex: maxVisible - i,
      }}
    >
      <AvatarCircle uri={av.uri} size={size} index={i} />
    </Animated.View>
  );

  const renderCounter = (slotIdx: number, ml: number) => {
    const slot = pool[Math.min(slotIdx, POOL_SIZE - 1)];
    return (
      <Animated.View
        key="counter"
        style={{ opacity: slot.opacity, transform: [{ translateX: slot.tx }], marginLeft: ml, zIndex: 0 }}
      >
        <View style={[st.circle, { width: size, height: size, borderRadius: r, backgroundColor: counterBg }]}>
          <Text style={[st.counterText, { fontSize: counterFontSize, color: counterColor }]}>+{extra}</Text>
        </View>
      </Animated.View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[st.row, containerStyle]}>
      {onlyCounter
        ? renderCounter(0, 0)
        : (
          <>
            {visible.map((av, i) => renderAvatar(av, i))}
            {showCounter && extra > 0 && renderCounter(visible.length, -overlap)}
          </>
        )
      }
    </View>
  );
}

const st = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center' },
  circle:      { borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  counterText: { fontWeight: '800' },
});
