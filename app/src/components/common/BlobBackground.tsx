import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import colors from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = { children: React.ReactNode };

// ─── Blob Config ─────────────────────────────────────────────────────────────
const NUM_LAYERS = 20;

/**
 * Generates 20 concentric circles that simulate CSS blur-3xl.
 * The opacity increments are very small to prevent visible "wave" artifacts.
 */
function makeBlobLayers(
  r: number, g: number, b: number,
  cx: number, cy: number,
  xEdge: 'right' | 'left',
  yEdge: 'top' | 'bottom',
  outerR = 300,
  maxAlpha = 0.08,
) {
  return Array.from({ length: NUM_LAYERS }, (_, i) => {
    // t goes 0 (outermost) → 1 (innermost)
    const t = i / (NUM_LAYERS - 1);
    const radius = outerR * (1 - t) + 20 * t; // outerR → 20px core
    const alpha  = maxAlpha * t + 0.003;       // 0.003 → maxAlpha
    const size   = radius * 2;

    return {
      key: i,
      style: {
        position: 'absolute' as const,
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: `rgba(${r},${g},${b},${alpha.toFixed(4)})`,
        [xEdge]: cx - radius,
        [yEdge]: cy - radius,
      },
    };
  });
}

export default function BlobBackground({ children }: Props) {
  // Orange blob — moved slightly more towards horizontal center
  const orangeLayers = makeBlobLayers(254, 215, 170, 180, 160, 'right', 'top', 320, 0.07);

  // Teal blob — moved slightly more towards horizontal center
  const tealLayers = makeBlobLayers(153, 246, 228, 120, 140, 'left', 'bottom', 280, 0.04);

  return (
    <View style={styles.root}>
      {/* 
          Fixed background layer: We set height/width to screen size 
          so that it doesn't resize or "jump" when the keyboard opens.
      */}
      <View style={styles.backgroundLayer}>
        {/* Same stops as theme (used app-wide via BlobBackground) */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Orange blob (20 smooth layers) */}
        {orangeLayers.map(({ key, style }) => (
          <View key={`o${key}`} style={style} />
        ))}

        {/* Teal blob (20 smooth layers) */}
        {tealLayers.map(({ key, style }) => (
          <View key={`t${key}`} style={style} />
        ))}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
    zIndex: -1,
  },
});
