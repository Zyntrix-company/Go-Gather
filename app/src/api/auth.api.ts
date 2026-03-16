/**
 * GatherGo Auth API — M1
 * All methods map 1:1 to the Postman collection endpoints.
 */
import { Platform } from 'react-native';
import client from './client';
import { User } from '../types/user.types';

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
};

export type ResendOtpPayload = {
  email: string;
  purpose: 'email-verification' | 'forgot-password';
};

export type ProfilePayload = {
  fullName: string;
  dob?: string;
  gender?: string;
  country?: string;
  bio?: string;
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
    isVerified: raw.isVerified,
    isProfileComplete: raw.isProfileComplete,
    fullName: raw.fullName || profile.fullName || raw.full_name || profile.full_name || '',
    dob: raw.dob || profile.dob || raw.date_of_birth || profile.date_of_birth || '',
    gender: raw.gender || profile.gender || '',
    country: raw.country || profile.country || '',
    bio: raw.bio || profile.bio || '',
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
   * PUT /users/photo  (multipart/form-data)
   * Returns the photo URL (CloudFront CDN URL).
   */
  uploadPhoto: async (fileUri: string, fileName: string, mimeType: string): Promise<{ photoUrl: string }> => {
    const formData = new FormData();
    formData.append('photo', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const { data } = await client.put('/users/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /**
   * POST /users/profile
   * Saves profile details and marks user as isProfileComplete = true.
   */
  saveProfile: async (payload: ProfilePayload): Promise<{ user: User }> => {
    const { data } = await client.post('/users/profile', payload);
    return data;
  },
};

export default authApi;
