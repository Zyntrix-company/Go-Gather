import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  appleAuth,
  AppleButton,
  AppleError,
} from '@invertase/react-native-apple-authentication';
import useAuth from '../../hooks/useAuth';

type Props = {
  disabled?: boolean;
  onSuccess: (user: any) => void;
  onError: (message: string) => void;
};

/**
 * "Continue with Apple" — iOS only. App Store Guideline 4.8 requires it alongside
 * Google sign-in. Uses Apple's native button so it meets Apple's design rules;
 * the white-outline style matches the Google button above it.
 */
export default function AppleSignInButton({ disabled, onSuccess, onError }: Props) {
  const { appleLogin } = useAuth();

  if (Platform.OS !== 'ios' || !appleAuth.isSupported) return null;

  async function onPress() {
    if (disabled) return;
    try {
      const credential = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        // Apple only returns these on the very first sign-in for this Apple ID
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      if (!credential.identityToken) {
        onError('Apple sign in failed.');
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
      onError(error?.response?.data?.message || 'Apple sign in failed.');
    }
  }

  return (
    <AppleButton
      buttonStyle={AppleButton.Style.WHITE_OUTLINE}
      buttonType={AppleButton.Type.CONTINUE}
      cornerRadius={9}
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  // Same footprint as the Google button (socialBtn) on the auth screens
  button: { width: '100%', height: 40, marginTop: 8 },
  disabled: { opacity: 0.6 },
});
