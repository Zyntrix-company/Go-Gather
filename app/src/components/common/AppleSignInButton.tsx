import React, { useState } from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { appleAuth, AppleError } from '@invertase/react-native-apple-authentication';
import useAuth from '../../hooks/useAuth';

/** Apple logo, sized like GoogleIcon (20×20) so both buttons line up. */
function AppleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#000000"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
      />
    </Svg>
  );
}

type Props = {
  /** The screen's Google-button styles, so both social buttons are identical. */
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  disabled?: boolean;
  onSuccess: (user: any) => void;
  onError: (message: string) => void;
};

/**
 * "Continue with Apple" — iOS only (App Store Guideline 4.8 requires it next to
 * Google). Custom button per Apple's HIG: black Apple logo + approved title,
 * otherwise styled exactly like "Continue with Google".
 */
export default function AppleSignInButton({ style, textStyle, disabled, onSuccess, onError }: Props) {
  const { appleLogin } = useAuth();
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== 'ios' || !appleAuth.isSupported) return null;

  async function onPress() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const credential = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        // Apple only returns these on the very first sign-in for this Apple ID
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      if (!credential.identityToken) {
        onError('Apple sign in failed. Please try again.');
        return;
      }
      const res = await appleLogin({
        identityToken: credential.identityToken,
        nonce: credential.nonce,
        authorizationCode: credential.authorizationCode,
        fullName: credential.fullName
          ? { givenName: credential.fullName.givenName, familyName: credential.fullName.familyName }
          : null,
      });
      onSuccess(res.user);
    } catch (error: any) {
      if (error?.code === AppleError.CANCELED) return;
      console.error('[Apple Login Error]:', error);
      if (error?.response?.data?.message) {
        onError(error.response.data.message);
      } else if (error?.code === AppleError.UNKNOWN || error?.code === AppleError.NOT_HANDLED) {
        // Usually: no Apple ID signed in on the device (Settings > Apple ID)
        onError('Sign in to your Apple ID in Settings, then try again.');
      } else if (!error?.response && error?.message === 'Network Error') {
        onError('No internet connection. Please try again.');
      } else {
        onError('Apple sign in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <TouchableOpacity
      style={style}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple">
      <AppleIcon />
      <Text style={textStyle}>Continue with Apple</Text>
    </TouchableOpacity>
  );
}
