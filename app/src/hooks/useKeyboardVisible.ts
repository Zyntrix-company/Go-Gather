import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * Tracks whether the soft keyboard is currently visible.
 *
 * Backed by `react-native-keyboard-controller` (see `KeyboardProvider` in
 * App.tsx) rather than RN core's `Keyboard` events, so it reports the same
 * keyboard state — from the same native source, on the same frame — as the
 * `KeyboardAvoider`/`KeyboardStickyComposer` components. Chrome that hides on
 * focus (tab bars, thumb strips) therefore moves in step with the composer
 * instead of a keyboard-animation behind it.
 */
export function useKeyboardVisible(): boolean {
  return useKeyboardState((state) => state.isVisible);
}

/**
 * Tracks the current soft-keyboard height (0 when hidden).
 *
 * Prefer `KeyboardAvoider` or `KeyboardStickyComposer` from
 * `components/common/KeyboardAvoider` over positioning things off this value —
 * they follow the keyboard continuously, whereas a height read here re-renders
 * only when the value settles.
 */
export function useKeyboardHeight(): number {
  return useKeyboardState((state) => state.height);
}
