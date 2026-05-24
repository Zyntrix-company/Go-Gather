/**
 * GatherGo Auth API — M1
 * All methods map 1:1 to the Postman collection endpoints.
 */
import { Platform } from 'react-native';
import client, { API_BASE } from './client';
import { User } from '../types/user.types';
import storage from '../utils/storage';
import useAuthStore from '../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginPayload = {
  email: string;
  password: string;
  deviceToken?: string;
  platform?: 'ios' | 'android';
};

export type SignupPayload = {
  email: string;
  phone?: string;
  password: string;
};

export type VerifyOtpPayload = {
  email: string;
  otp: string;
  deviceToken?: string;
  platform?: 'ios' | 'android';
};

export type ResendOtpPayload = {
  email: string;
  purpose: 'email-verification' | 'forgot-password';
};

export type ProfilePayload = {
  fullName: string;
  gender?: string;
  country?: string;
  bio?: string;
  dob?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = AuthTokens & {
  user: User;
};

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * Flatten the backend's nested user.profile into a single User object.
 * Backend shape: { accessToken, refreshToken, user: { id, email, ..., profile: { fullName, avatarUrl, ... } } }
 */
function normalizeUser(raw: any): User {
  if (!raw) return {} as User;
  const profile = raw.profile ?? {};

  const photo = raw.photoUrl ||
    profile.avatarUrl ||
    profile.photoUrl ||
    raw.avatarUrl ||
    raw.photo_url ||
    profile.photo_url ||
    raw.avatar ||
    profile.avatar ||
    raw.photo ||
    profile.photo ||
    '';

  return {
    id: raw.id || raw._id,
    email: raw.email,
    phone: raw.phone,
    username: raw.username || profile.username || '',
    isVerified: raw.isVerified,
    isProfileComplete: raw.isProfileComplete,
    fullName: raw.fullName || profile.fullName || raw.name || raw.full_name || profile.full_name || raw.displayName || '',
    gender: raw.gender || profile.gender || raw.sex || '',
    country: raw.country || profile.country || (raw.locale ? raw.locale.split('-').pop().toUpperCase() : ''),
    bio: raw.bio || profile.bio || '',
    dob: raw.dob || profile.dob || raw.birthday || profile.birthday || '',
    photoUrl: photo,
    avatarUrl: photo,
    profile: profile,
  };
}

function normalizeAuthResponse(data: any): AuthResponse {
  const raw = data.user ?? data;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: normalizeUser(raw),
  };
}

const authApi = {
  /**
   * POST /auth/signup
   */
  signup: async (payload: SignupPayload): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/signup', payload);
    return data;
  },

  /**
   * POST /auth/verify-email
   */
  verifyOtp: async (payload: VerifyOtpPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/verify-email', payload);
    return normalizeAuthResponse(data);
  },

  /**
   * POST /auth/resend-otp
   */
  resendOtp: async (payload: ResendOtpPayload): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/resend-otp', payload);
    return data;
  },

  /**
   * POST /auth/login
   */
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/login', {
      ...payload,
      platform: payload.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android'),
    });
    return normalizeAuthResponse(data);
  },

  /**
   * POST /auth/google
   */
  googleLogin: async (idToken: string, deviceToken?: string): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/google', {
      idToken,
      deviceToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return normalizeAuthResponse(data);
  },

  /**
   * POST /auth/facebook
   */
  facebookLogin: async (accessToken: string, deviceToken?: string): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/facebook', {
      accessToken,
      deviceToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return normalizeAuthResponse(data);
  },

  /**
   * GET /auth/me
   * Used in Splash/App init to check token validity and profile status.
   * The client interceptor will auto-inject the Authorization header.
   */
  getMe: async (): Promise<User> => {
    const { data } = await client.get('/auth/me');
    // Backend shape: { message, user: { ... } } or { id, email, ... }
    const raw = data.user ?? data;
    return normalizeUser(raw);
  },

  /**
   * POST /auth/refresh
   * Called automatically by the client interceptor on 401.
   * Can also be called manually if needed.
   */
  refreshTokens: async (refreshToken: string): Promise<AuthTokens> => {
    const { data } = await client.post('/auth/refresh', { refreshToken });
    return data;
  },

  /**
   * POST /auth/logout
   * Requires accessToken (auto-injected) + refreshToken in body.
   */
  logout: async (refreshToken: string): Promise<void> => {
    await client.post('/auth/logout', { refreshToken });
  },

  /**
   * POST /auth/forgot-password
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/forgot-password', { email });
    return data;
  },

  /**
   * POST /auth/reset-password
   */
  resetPassword: async (email: string, otp: string, password: string): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/reset-password', { email, otp, password });
    return data;
  },

  /**
   * POST /auth/change-password
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  /**
   * PUT /users/photo  (multipart/form-data)
   * Returns the photo URL (CloudFront CDN URL).
   */
  uploadPhoto: async (fileUri: string, fileName: string, mimeType: string): Promise<{ photoUrl: string; cdnUrl: string }> => {
    // XMLHttpRequest is used instead of fetch because fetch+FormData has known
    // Android compatibility issues with content:// URIs and gives no progress info.
    // XHR handles multipart uploads more reliably across Android versions.

    // XHR bypasses the axios interceptor — no auto-refresh. Read the token from
    // the in-memory store first (always up-to-date after login/refresh), then
    // fall back to secure storage. This avoids the stale-token 401 without
    // adding an extra network round-trip.
    const token =
      useAuthStore.getState().accessToken ||
      (await storage.getToken());

    console.log('[uploadPhoto] ── Starting XHR upload ──────────────────────────');
    console.log('[uploadPhoto] URI scheme :', fileUri.split('://')[0] + '://');
    console.log('[uploadPhoto] fileName   :', fileName);
    console.log('[uploadPhoto] mimeType   :', mimeType);
    console.log('[uploadPhoto] token OK   :', !!token);
    console.log('[uploadPhoto] endpoint   :', `${API_BASE}/users/photo`);

    const formData = new FormData();
    formData.append('photo', { uri: fileUri, name: fileName, type: mimeType } as any);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API_BASE}/users/photo`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 30000; // 30-second timeout — avoids silent hangs on slow networks

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          console.log(`[uploadPhoto] Progress: ${pct}%  (${e.loaded}/${e.total} bytes)`);
        }
      };

      xhr.onload = () => {
        console.log('[uploadPhoto] HTTP status:', xhr.status);
        let data: any = {};
        try {
          data = JSON.parse(xhr.responseText);
          console.log('[uploadPhoto] Raw response:', JSON.stringify(data));
        } catch {
          console.warn('[uploadPhoto] Could not parse response JSON:', xhr.responseText);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          // Backend returns { avatarUrl: cdnUrl, cdnUrl }
          // Both are permanent CloudFront URLs — bucket is public, no presigning needed.
          const cdnUrl: string = data.cdnUrl ?? '';
          const photoUrl: string =
            data.photoUrl ??
            data.url ??
            data.avatarUrl ??
            data.user?.profile?.avatarUrl ??
            data.user?.avatarUrl ??
            data.user?.photoUrl ??
            data.avatar ??
            data.photo_url ??
            data.photo ??
            '';
          console.log('[uploadPhoto] Extracted photoUrl:', photoUrl || '(EMPTY — field name mismatch, see Raw response above)');
          console.log('[uploadPhoto] Extracted cdnUrl:', cdnUrl || '(not returned by backend)');
          resolve({ photoUrl, cdnUrl });
        } else {
          const err: any = new Error(data?.message || `Upload failed with status ${xhr.status}`);
          err.response = { data, status: xhr.status };
          reject(err);
        }
      };

      xhr.onerror = () => {
        console.error('[uploadPhoto] XHR onerror — connection-level failure');
        console.error('[uploadPhoto] Server may have closed the connection (file too large?)');
        console.error('[uploadPhoto] ► Backend: check multer/busboy fileSize limit on PUT /users/photo');
        reject(new Error('Network request failed'));
      };

      xhr.ontimeout = () => {
        console.error('[uploadPhoto] XHR timed out after 30s');
        console.error('[uploadPhoto] ► Backend: upload handler may be hanging; check server logs');
        reject(new Error('Upload timed out — please try again'));
      };

      xhr.send(formData);
    });
  },

  /**
   * POST /users/profile
   * Saves profile details and marks user as isProfileComplete = true.
   */
  saveProfile: async (payload: ProfilePayload): Promise<{ user: User }> => {
    const { data } = await client.post('/users/profile', payload);
    return data;
  },

  /**
   * PUT /users/profile
   * Updates mutable profile fields for an already-complete profile.
   * username — the only way to change your handle after signup. Format: `^[a-z0-9_]{3,20}$`. Returns 409 if already taken.
   */
  updateProfile: async (payload: {
    fullName?: string;
    gender?: string;
    country?: string;
    bio?: string;
    dob?: string;
    username?: string;
  }): Promise<User> => {
    const { data } = await client.put('/users/profile', payload);
    // Backend returns: { message, user: { id, username, profile: { fullName, bio, country, avatarUrl, updatedAt } } }
    const raw = data.user ?? data;
    return normalizeUser(raw);
  },
};

export default authApi;
