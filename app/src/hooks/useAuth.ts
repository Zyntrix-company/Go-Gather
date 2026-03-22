import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager } from 'react-native-fbsdk-next';
import useAuthStore from '../store/authStore';
import authApi from '../api/auth.api';
import storage from '../utils/storage';


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
  async function login(email: string, password: string, deviceToken?: string) {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password, deviceToken });
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
   * Google Login
   */
  async function googleLogin(idToken: string) {
    setLoading(true);
    try {
      const res = await authApi.googleLogin(idToken);
      await storage.setToken(res.accessToken);
      if (res.refreshToken) await storage.setRefreshToken(res.refreshToken);
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
      const res = await authApi.facebookLogin(accessToken);
      await storage.setToken(res.accessToken);
      if (res.refreshToken) await storage.setRefreshToken(res.refreshToken);
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
    } catch {
      // Token may be invalid — clear and force re-login
      await storage.clearAll();
      storeLogout();
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
    const photoUrl = res.photoUrl;
    console.log('[useAuth.uploadPhoto] photoUrl from API:', photoUrl || '(EMPTY)');
    if (photoUrl) {
      useAuthStore.getState().updateUser({ photoUrl, avatarUrl: photoUrl });
      console.log('[useAuth.uploadPhoto] Store updated with photoUrl');
    }
    console.log('[useAuth.uploadPhoto] Calling refreshProfile...');
    const refreshed = await refreshProfile();
    console.log('[useAuth.uploadPhoto] refreshProfile result — photoUrl:', refreshed?.photoUrl || '(EMPTY)');
    return photoUrl;
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
    saveProfile 
  };
}
