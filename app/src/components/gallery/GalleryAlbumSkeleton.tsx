import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

/** Pulse placeholder for a gallery album — while photos load, or while the first upload runs. */
export default function GalleryAlbumSkeleton({ heroH }: { heroH: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  const pageW = Dimensions.get('window').width;
  const innerW = pageW - 32;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const B = ({ w, h, r = 8, style: s }: { w: number | string; h: number; r?: number; style?: object }) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#e2e8f0', opacity: pulse }, s]} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <B w={innerW} h={Math.max(heroH - 10, 200)} r={18} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 5 }}>
        {[0, 1, 2, 3, 4].map(i => <B key={i} w={64} h={50} r={8} />)}
      </View>
      <B w={160} h={13} r={6} style={{ marginLeft: 16, marginTop: 12 }} />
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingTop: 16 }}>
        <B w={68} h={18} r={9} />
        <B w={90} h={18} r={9} />
      </View>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, alignItems: 'center' }}>
          <B w={32} h={32} r={16} />
          <View style={{ flex: 1, gap: 6 }}>
            <B w="42%" h={12} r={6} />
            <B w="68%" h={11} r={5} />
          </View>
        </View>
      ))}
    </View>
  );
}
