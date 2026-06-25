import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

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
