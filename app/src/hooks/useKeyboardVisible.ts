import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Tracks whether the soft keyboard is currently visible.
 * Used by the gallery album view to reclaim vertical space for the comment
 * panel while composing/editing so the active input stays above the keyboard.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

/**
 * Tracks the current soft-keyboard height (0 when hidden).
 *
 * Used to pin a composer bar inside a transparent Modal directly above the
 * keyboard. A RN Modal is a separate window that does not honour the activity's
 * adjustResize, so the reported keyboard height is exactly how far to offset the
 * bar — no double counting, works the same on iOS and Android.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS fires *Will* events (smoother, fires before the keyboard animates in);
    // Android only reliably fires *Did* events.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
