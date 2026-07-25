import React from 'react';
import { StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

/**
 * Re-exported so screens that render a composer/form inside a RN `Modal` have a
 * single import for it. A `Modal` is a separate native window with its own
 * keyboard insets that the app-root provider (App.tsx) can't see, so nest one
 * of these directly inside the `Modal` around the `KeyboardAvoider`.
 */
export { KeyboardProvider };

/**
 * The app's single keyboard-avoidance mechanism.
 *
 * Everything here sits on `react-native-keyboard-controller`, whose
 * `KeyboardProvider` (see App.tsx) owns the native IME insets. That means the
 * window never auto-resizes for the keyboard on any Android version, so there
 * is exactly one source of truth for keyboard height and no per-screen
 * `keyboardVerticalOffset` guesswork. Do not reintroduce RN core's
 * `KeyboardAvoidingView` alongside this — mixing the two double-shrinks the
 * layout.
 */

type KeyboardAvoiderProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * Pass `"box-none"` when the avoider overlays something tappable behind it
   * (e.g. a modal scrim) — otherwise it fills the screen and swallows taps.
   */
  pointerEvents?: ViewProps['pointerEvents'];
  /**
   * Bottom spacing the content *already* reserves when the keyboard is closed
   * (e.g. a floating tab bar plus the safe-area inset).
   *
   * The library computes `paddingBottom = max(keyboardHeight + offset, 0)` for a
   * view spanning to the screen bottom, so passing this as a negative offset
   * makes the total bottom space `max(existingBottomSpace, keyboardHeight)`
   * rather than the sum of the two. Stacking them is exactly what made
   * composers float a tab-bar height above the keyboard. Pass a positive
   * number; it is negated here.
   */
  existingBottomSpace?: number;
};

/**
 * For scrolling forms and chat containers: pads the bottom of the container by
 * the keyboard height so the focused field stays visible and any list above it
 * shrinks to match. Works identically on iOS and Android.
 */
export function KeyboardAvoider({
  children,
  style,
  pointerEvents,
  existingBottomSpace = 0,
}: KeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior="padding"
      pointerEvents={pointerEvents}
      keyboardVerticalOffset={-existingBottomSpace}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

type KeyboardStickyComposerProps = {
  children: React.ReactNode;
  /**
   * How much clear space to leave *below* the bar while the keyboard is closed
   * — typically the floating tab bar height plus the safe-area bottom inset.
   * Pass a positive number; it is negated internally because
   * `KeyboardStickyView`'s `offset.closed` is a raw translateY where negative
   * means "up". When the keyboard opens the bar sits flush against it and this
   * offset is released.
   */
  closedOffset?: number;
  style?: ViewStyle;
};

/**
 * For composer bars that pin directly to the top of the keyboard (Swee chat,
 * gallery comments). Tracks the IME frame-by-frame, so it follows mid-flight
 * height changes too — switching to the emoji keyboard, an OEM keyboard's
 * toolbar row appearing, or iOS's predictive bar toggling.
 */
export function KeyboardStickyComposer({
  children,
  closedOffset = 0,
  style,
}: KeyboardStickyComposerProps) {
  return (
    <KeyboardStickyView
      style={style}
      offset={{ closed: -closedOffset, opened: 0 }}
    >
      {children}
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
