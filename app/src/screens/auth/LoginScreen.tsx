import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../../utils/validators';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';

type FormData = {
  email: string;
  password: string;
};

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

function FacebookIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  );
}

function EyeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </Svg>
  );
}

function EyeOffIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
    </Svg>
  );
}

export default function LoginScreen({ navigation }: any) {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(loginSchema),
  });
  const { login, googleLogin, facebookLogin } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const setPendingProfileSetup = useAuthStore((s) => s.setPendingProfileSetup);

  function handleLoginNavigation(user: any) {
    if (user.isVerified === false) {
      return navigation.replace('OtpVerification', { email: user.email });
    }
    if (user.isProfileComplete === false) {
      setPendingProfileSetup(true);
      return;
    }
    // Home navigation is handled automatically by RootNavigator when store updates
  }

  async function onSubmit(data: FormData) {
    try {
      setApiError(null);
      const res = await login(data.email, data.password);
      console.log('[Login Success]: User authenticated:', res.user?.email);
      handleLoginNavigation(res.user);
    } catch (err: any) {
      console.error('[Login Error]:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Invalid email or password.';
      setApiError(msg);
    }
  }

  async function onGoogleButtonPress() {
    try {
      setApiError(null);
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (idToken) {
        const res = await googleLogin(idToken);
        // Try extracting DOB from Google People API (best-effort, silent fail)
        try {
          const tokens = await GoogleSignin.getTokens();
          if (tokens.accessToken) {
            const peopleRes = await fetch(
              'https://people.googleapis.com/v1/people/me?personFields=birthdays',
              { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            );
            const peopleData = await peopleRes.json();
            const bday = peopleData?.birthdays?.[0]?.date;
            if (bday?.year && bday?.month && bday?.day) {
              const dob = `${bday.year}-${String(bday.month).padStart(2, '0')}-${String(bday.day).padStart(2, '0')}`;
              useAuthStore.getState().updateUser({ dob });
            }
          }
        } catch { /* DOB is optional */ }
        console.log('[Google Login Success]:', res.user?.email);
        handleLoginNavigation(res.user);
      }
    } catch (error: any) {
      console.error('[Google Login Error]:', error);
      if (error.code !== 'SIGN_IN_CANCELLED') {
        setApiError('Google sign in failed.');
      }
    }
  }

  async function onFacebookButtonPress() {
    try {
      setApiError(null);
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email', 'user_birthday']);
      if (result.isCancelled) return;

      const data = await AccessToken.getCurrentAccessToken();
      if (data) {
        const res = await facebookLogin(data.accessToken);
        // Try extracting DOB from Facebook Graph API (best-effort, silent fail)
        try {
          const fbRes = await fetch(
            `https://graph.facebook.com/me?fields=birthday&access_token=${data.accessToken}`,
          );
          const fbData = await fbRes.json();
          if (fbData?.birthday) {
            // Facebook returns MM/DD/YYYY → convert to YYYY-MM-DD
            const parts = fbData.birthday.split('/');
            if (parts.length === 3) {
              const dob = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              useAuthStore.getState().updateUser({ dob });
            }
          }
        } catch { /* DOB is optional */ }
        console.log('[Facebook Login Success]:', res.user?.email);
        handleLoginNavigation(res.user);
      }
    } catch (error: any) {
      console.error('[Facebook Login Error]:', error);
      setApiError('Facebook sign in failed.');
    }
  }

  return (
    <BlobBackground>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Logo – top left (matches Figma mb-14) */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          {/* Form container (max-w-sm mx-auto) */}
          <View style={styles.form}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to access your trips and groups.</Text>

            {/* Google — space-y-2 gap between buttons */}
            <TouchableOpacity 
              style={styles.socialBtn} 
              activeOpacity={0.75} 
              onPress={onGoogleButtonPress}
              disabled={isLoading}>
              <GoogleIcon />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity 
              style={[styles.socialBtn, styles.socialBtnGap]} 
              activeOpacity={0.75} 
              onPress={onFacebookButtonPress}
              disabled={isLoading}>
              <FacebookIcon />
              <Text style={styles.socialBtnText}>Continue with Facebook</Text>
            </TouchableOpacity>

            {/* Divider — flex items-center gap-3 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === 'email' && styles.inputFocused,
                      errors.email && styles.inputError,
                    ]}
                    placeholder="Email address"
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(val) => {
                      onChange(val);
                      if (apiError) setApiError(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    selectionColor="#0d9488"
                    editable={!isLoading}
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email.message}</Text>
                  )}
                </>
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <View style={[
                  styles.passwordWrap,
                  focusedField === 'password' && styles.inputFocused
                ]}>
                  <TextInput
                    style={styles.passwordField}
                    placeholder="Password"
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(val) => {
                      onChange(val);
                      if (apiError) setApiError(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    underlineColorAndroid="transparent"
                    selectionColor="#0d9488"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </TouchableOpacity>
                </View>
              )}
            />

            {/* API Error Message */}
            {apiError && (
              <Text style={styles.apiErrorText}>{apiError}</Text>
            )}

            {/* Log In button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Log In</Text>}
            </TouchableOpacity>

            {/* Forgot password — pt-1, text-center */}
            <View style={styles.linkRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}>
                <Text style={styles.linkUnderline}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Switch to Signup — pt-1 */}
            <View style={styles.linkRow}>
              <Text style={styles.linkPlain}>New here? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Signup')}
                activeOpacity={0.7}>
                <Text style={styles.linkUnderline}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Logo row — mb-14 from Figma
  logoRow: {
    marginBottom: 58,
    alignItems: 'flex-start',
  },

  // Form container — max-w-sm mx-auto
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  // Typography — matches Figma text-2xl / text-slate-600 text-sm mb-10
  title: {
    fontSize: 27, // Increased from 24
    fontWeight: '400',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#505c6dff',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },

  // Social buttons — rounded-lg (matches web rounded-lg)
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  socialBtnGap: { marginTop: 8 },
  socialBtnText: { fontSize: 16, color: '#334155', fontWeight: '400' },

  // Divider — flex items-center gap-3
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 17, color: '#94a3b8' },

  // Inputs
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 16,
    color: '#0f172a',
    marginTop: 8,
  },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 2,
  },
  apiErrorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  passwordWrap: {
    position: 'relative',
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    overflow: 'hidden',
  },
  passwordField: {
    width: '100%',
    paddingHorizontal: 11,
    paddingVertical: 9,
    paddingRight: 44,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 1,
  },

  // Primary button — rounded-lg (matches web rounded-lg)
  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Link rows
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  linkPlain: { fontSize: 14, color: '#515e70ff' }, // Increased from 12
  linkUnderline: {
    fontSize: 16, // Increased from 12
    color: '#0d9488',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Thin divider line between footer links
  linkDivider: {
    marginVertical: 6,
    alignItems: 'center',
  },
  linkDividerLine: {
    width: '60%',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
});
