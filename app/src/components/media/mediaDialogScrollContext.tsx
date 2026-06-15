import { createContext, useContext } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';

export type MediaDialogScrollContextValue = {
  scrollableRef: AnimatedRef<Animated.ScrollView>;
  onSectionDragStart: () => void;
  onSectionDragEnd: () => void;
};

const MediaDialogScrollContext = createContext<MediaDialogScrollContextValue | null>(null);

export function useMediaDialogScroll(): MediaDialogScrollContextValue {
  const value = useContext(MediaDialogScrollContext);
  if (!value) {
    throw new Error('useMediaDialogScroll must be used within MediaDialogLayout');
  }
  return value;
}

export default MediaDialogScrollContext;
