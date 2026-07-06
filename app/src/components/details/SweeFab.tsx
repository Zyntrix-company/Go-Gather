/**
 * SweeFab — draggable floating action button for the Swee AI assistant.
 * Extracted from TripDetailScreen so it can be reused across detail screens.
 * Styles match TripDetailScreen exactly so visual output is unchanged.
 */
import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SweeIcon from '../common/SweeIcon';
import { TAB_BAR_BASE_HEIGHT } from '../common/FloatingTabBar';

interface SweeFabProps {
  onPress: () => void;
  fabStyle?: object;
}

// Gap between the FAB and the top of the footer tab bar.
const FAB_FOOTER_GAP = 12;

export default function SweeFab({ onPress, fabStyle }: SweeFabProps) {
  const insets = useSafeAreaInsets();
  // Sit just above the footer on every screen/device: the footer is
  // `TAB_BAR_BASE_HEIGHT + insets.bottom` tall, so add a small gap on top.
  const bottom = TAB_BAR_BASE_HEIGHT + insets.bottom + FAB_FOOTER_GAP;
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
      style={[styles.fab, { bottom }, fabStyle, { transform: pan.getTranslateTransform() }]}
      {...pr.panHandlers}
    >
      <SweeIcon size={22} />
    </Animated.View>
  );
}

// Styles intentionally match TripDetailScreen's sweeFab style exactly
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
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
