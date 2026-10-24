import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, ModalProps, NativeSyntheticEvent, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

// iOS presents a <Modal> from the screen it is declared in, and a screen can present only
// one at a time. A modal opened beside one that is already showing (Settle Up over
// Expenses, an alert over any dialog) is refused by UIKit and never appears, while React
// thinks it is open. Android stacks them fine.
//
// So on iOS a modal stays native when nothing else is showing, or when it is declared inside
// a native modal (that already works). Only a modal that opens beside one that is showing
// is drawn in a FullWindowOverlay on top instead — same content, backdrop and animation.
// Android always gets a plain <Modal>.

type Layer = 'native' | 'overlay';

/** Layer of the modal this content is rendered inside, if any. */
const ParentLayerContext = createContext<Layer | null>(null);

/** Modals (native or overlay) currently holding the screen, across the whole app. */
let openCount = 0;

// A native modal holds its slot until iOS reports it dismissed, so nothing is presented while
// it is still animating out. Fallback in case onDismiss never fires.
const DISMISS_FALLBACK_MS = 1000;
const FADE_MS = 250;
const SLIDE_MS = 300;

export default function StackedModal(props: ModalProps) {
  if (Platform.OS !== 'ios') return <Modal {...props} />;
  return <IosStackedModal {...props} />;
}

function IosStackedModal({ visible = true, onDismiss, children, ...props }: ModalProps) {
  const parentLayer = useContext(ParentLayerContext);
  const [layer, setLayer] = useState<Layer | null>(null);
  const holding = useRef(false);

  const freeSlot = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    openCount--;
  }, []);

  const release = useCallback(() => {
    freeSlot();
    setLayer(null);
  }, [freeSlot]);

  // Pick the layer before paint, when the modal opens.
  useLayoutEffect(() => {
    if (!visible) return;
    if (layer === null) {
      const othersOpen = openCount - (holding.current ? 1 : 0) > 0;
      setLayer(parentLayer === 'native' ? 'native'
        : parentLayer === 'overlay' || othersOpen ? 'overlay'
        : 'native');
    }
    if (!holding.current) {
      holding.current = true;
      openCount++;
    }
  }, [visible, layer, parentLayer]);

  useEffect(() => {
    if (visible || layer !== 'native') return;
    const t = setTimeout(release, DISMISS_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [visible, layer, release]);

  useEffect(() => freeSlot, [freeSlot]);

  const content = <ParentLayerContext.Provider value={layer}>{children}</ParentLayerContext.Provider>;

  if (layer === 'overlay') {
    return (
      <OverlayLayer {...props} visible={visible} onDismiss={onDismiss} onClosed={release}>
        {content}
      </OverlayLayer>
    );
  }

  return (
    <Modal
      {...props}
      visible={visible && layer === 'native'}
      onDismiss={() => {
        onDismiss?.();
        // A pageSheet swiped down is gone while `visible` is still true until the caller
        // updates it: free the slot now, keep the layer for that update.
        if (visible) freeSlot();
        else release();
      }}
    >
      {content}
    </Modal>
  );
}

function OverlayLayer({
  visible,
  transparent,
  animationType = 'none',
  onShow,
  onDismiss,
  onClosed,
  children,
}: ModalProps & { onClosed: () => void }) {
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: animationType === 'none' ? 0 : animationType === 'slide' ? SLIDE_MS : FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (visible) {
        onShow?.({} as NativeSyntheticEvent<any>);
      } else {
        onDismiss?.();
        onClosed();
      }
    });
    return () => anim.stop();
    // Re-run only when visibility flips; the callbacks are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const motion = animationType === 'slide'
    ? { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
    : { opacity: progress };

  return (
    <FullWindowOverlay>
      <Animated.View
        style={[StyleSheet.absoluteFill, !transparent && styles.opaque, motion]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {children}
      </Animated.View>
    </FullWindowOverlay>
  );
}

const styles = StyleSheet.create({
  opaque: { backgroundColor: '#fff' },
});
