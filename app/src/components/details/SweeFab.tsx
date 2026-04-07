/**
 * SweeFab — draggable floating action button for the Swee AI assistant.
 * Extracted from TripDetailScreen so it can be reused across detail screens.
 * Styles match TripDetailScreen exactly so visual output is unchanged.
 */
import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SweeFabProps {
  onPress: () => void;
}

function SparkleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063A2 2 0 0014.063 15.5l-1.582 6.135a.5.5 0 01-.963 0z"
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SweeFab({ onPress }: SweeFabProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const moved = useRef(false);

  const pr = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        moved.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, g);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        if (!moved.current) onPress();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.fab, { transform: pan.getTranslateTransform() }]}
      {...pr.panHandlers}
    >
      <SparkleIcon />
    </Animated.View>
  );
}

// Styles intentionally match TripDetailScreen's sweeFab style exactly
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 8,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    zIndex: 50,
  },
});
