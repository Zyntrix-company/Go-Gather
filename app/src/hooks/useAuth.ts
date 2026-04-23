import messaging from '@react-native-firebase/messaging';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager } from 'react-native-fbsdk-next';
import { Platform, PermissionsAndroid } from 'react-native';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import authApi from '../api/auth.api';
import storage from '../utils/storage';

async function getFcmTokenForLogin(): Promise<string | undefined> {
  try {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    return await messaging().getToken();
  } catch {
    return undefined;
  }
}


export default function useAuth() {
  const { setAuth, logout: storeLogout, setLoading } = useAuthStore();

  /**
   * Signup — only triggers OTP. Does NOT store tokens here.
   * Tokens arrive after OTP verification.
   */
  async function signup(email: string, phone: string | undefined, password: string) {
    setLoading(true);
    try {
      const res = await authApi.signup({ email, phone, password });
      return res;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Verify OTP — called from OtpVerificationScreen.
   * Stores tokens securely, updates store, then fetches full profile from /auth/me.
   */
  async function verifyOtp(email: string, otp: string) {
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email, otp });
      await storage.setToken(res.accessToken);
      await storage.setRefreshToken(res.refreshToken);
      setAuth(res.user, res.accessToken, res.refreshToken);
      // Fetch full profile so store has complete name/photo data
      try { await authApi.getMe().then(u => setAuth(u, res.accessToken, res.refreshToken)); } catch {}
      return res;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Login with email & password.
   * After setting tokens, fetches full profile from /auth/me so the store
   * always has complete name/photo data regardless of what the login response returns.
   */
  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const deviceToken = await getFcmTokenForLogin();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const res = await authApi.login({ email, password, deviceToken, platform });
      await storage.setToken(res.accessToken);
      await storage.setRefreshToken(res.refreshToken);
      useNotificationStore.getState().clearNotifications();
      setAuth(res.user, res.accessToken, res.refreshToken);
      // Fetch full profile so store has complete name/photo data
      try { await authApi.getMe().then(u => setAuth(u, res.accessToken, res.refreshToken)); } catch {}
      return res;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Google Login
   */
  async function googleLogin(idToken: string) {
    setLoading(true);
    try {
      const deviceToken = await getFcmTokenForLogin();
      const res = await authApi.googleLogin(idToken, deviceToken);
      await storage.setToken(res.accessToken);
      if (res.refreshToken) await storage.setRefreshToken(res.refreshToken);
      useNotificationStore.getState().clearNotifications();
      setAuth(res.user, res.accessToken, res.refreshToken);
      // Fetch full profile so store has complete name/photo data
      try { await authApi.getMe().then(u => setAuth(u, res.accessToken, res.refreshToken)); } catch {}
      return res;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Facebook Login
   */
  async function facebookLogin(accessToken: string) {
    setLoading(true);
    try {
      const deviceToken = await getFcmTokenForLogin();
      const res = await authApi.facebookLogin(accessToken, deviceToken);
      await storage.setToken(res.accessToken);
      if (res.refreshToken) await storage.setRefreshToken(res.refreshToken);
      useNotificationStore.getState().clearNotifications();
      setAuth(res.user, res.accessToken, res.refreshToken);
      // Fetch full profile so store has complete name/photo data
      try { await authApi.getMe().then(u => setAuth(u, res.accessToken, res.refreshToken)); } catch {}
      return res;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Logout — calls API and clears all local state & tokens.
   */
  async function logout() {
    setLoading(true);
    try {
      // 1. Social Sign Outs
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Silently ignore if not logged in via Google
      }
      try {
        LoginManager.logOut();
      } catch (e) {
        // Silently ignore
      }

      // 2. Clear backend session
      const refreshToken = await storage.getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {
          // Silently ignore API errors on logout
        });
      }
    } finally {
      // 3. Clear local storage and store
      await storage.clearAll();
      useNotificationStore.getState().clearNotifications();
      storeLogout();
      setLoading(false);
    }
  }

  /**
   * Called from Splash screen / app init.
   * Tries to restore the session from secure storage.
   * Returns user if session is valid, null otherwise.
   */
  async function loadFromToken() {
    setLoading(true);
    try {
      // Keychain can fail silently on Android — fall back to in-memory store
      const token = (await storage.getToken()) || useAuthStore.getState().accessToken;
      if (!token) {
        setLoading(false);
        return null;
      }

      const user = await authApi.getMe();
      const refreshToken = (await storage.getRefreshToken()) || useAuthStore.getState().refreshToken;
      setAuth(user, token, refreshToken);
      return user;
    } catch (err: any) {
      // Only wipe tokens when the server explicitly rejects credentials (401/403)
      // AND there is no network-level error (e.g. timeout, ECONNREFUSED).
      // Network errors have no response object — err.response is undefined.
      // Treat those as "server temporarily unreachable" and keep the session alive.
      const status = err?.response?.status;
      const isNetworkError = !err?.response && (
        err?.code === 'ECONNABORTED' ||   // axios timeout
        err?.code === 'ERR_NETWORK' ||    // no internet
        err?.message?.includes('Network') ||
        err?.message?.includes('timeout')
      );
      const isAuthFailure = (status === 401 || status === 403) && !isNetworkError;

      if (isAuthFailure) {
        await storage.clearAll();
        storeLogout();
      } else {
        // Network/server error — keep tokens, restore store from storage so
        // RootNavigator still sees isAuthenticated = true.
        const token = (await storage.getToken()) || useAuthStore.getState().accessToken;
        const refreshToken = (await storage.getRefreshToken()) || useAuthStore.getState().refreshToken;
        if (token) {
          setAuth(null, token, refreshToken);
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Resend OTP for email verification or password reset.
   */
  async function resendOtp(email: string, purpose: 'email-verification' | 'forgot-password' = 'email-verification') {
    const res = await authApi.resendOtp({ email, purpose });
    return res;
  }

  /**
   * Upload profile photo via multipart form.
   * Updates the store immediately so the new photo is visible everywhere.
   * Returns the CDN URL of the uploaded image.
   */
  async function uploadPhoto(fileUri: string, fileName: string, mimeType: string) {
    const res = await authApi.uploadPhoto(fileUri, fileName, mimeType);
    // Prefer cdnUrl (permanent CloudFront URL, safe to cache indefinitely).
    // Fall back to photoUrl which may be a presigned S3 URL (1-hour expiry) in
    // local dev when CloudFront is not configured — acceptable there since the
    // dev session is short-lived. Never store presigned URLs long-term in prod.
    // Each upload generates a new UUID-based S3 key so the URL is always unique;
    // no cache-busting param is needed.
    const storeUrl = res.cdnUrl || res.photoUrl;
    if (storeUrl) {
      useAuthStore.getState().updateUser({ photoUrl: storeUrl, avatarUrl: storeUrl });
      // Do NOT call refreshProfile here — setAuth inside it replaces the entire
      // user object and would wipe the URL we just patched in.
    }
    return storeUrl;
  }

  /**
   * Refresh the user profile from the server and sync the store.
   * Safe to call anywhere — will NOT clear tokens on failure.
   */
  async function refreshProfile() {
    try {
      // Keychain can fail silently on Android — fall back to in-memory store
      const token = (await storage.getToken()) || useAuthStore.getState().accessToken;
      if (!token) return null;
      const user = await authApi.getMe();
      // Preserve a locally-extracted DOB (e.g. from Google People API or Facebook
      // Graph API) if the server hasn't stored one yet. Without this, the server
      // response would overwrite the dob set via updateUser() in the login flow.
      const storedDob = useAuthStore.getState().user?.dob;
      if (!user.dob && storedDob) {
        user.dob = storedDob;
      }
      const refreshToken = (await storage.getRefreshToken()) || useAuthStore.getState().refreshToken;
      setAuth(user, token, refreshToken);
      return user;
    } catch (e: any) {
      console.warn('[refreshProfile] Failed:', e?.response?.status, e?.message);
      return null;
    }
  }

  /**
   * Save profile details (Step B of CreateProfile).
   * After saving, always re-fetches from server to keep store up to date.
   */
  async function saveProfile(payload: {
    fullName: string;
    gender?: string;
    country?: string;
    bio?: string;
    dob?: string;
  }) {
    setLoading(true);
    try {
      await authApi.saveProfile(payload);
      // Always re-fetch from server so store has the latest saved data
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  }

  async function editProfile(payload: {
    fullName?: string;
    gender?: string;
    country?: string;
    bio?: string;
    dob?: string;
    username?: string;
  }) {
    setLoading(true);
    try {
      await authApi.updateProfile(payload);
      // Re-fetch full user from /auth/me so the store has every field including
      // avatar_url, email, isVerified, etc. — updateProfile response is partial.
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  }

  return {
    signup,
    verifyOtp,
    login,
    googleLogin,
    facebookLogin,
    logout,
    loadFromToken,
    refreshProfile,
    resendOtp,
    uploadPhoto,
    saveProfile,
    editProfile,
  };
}
