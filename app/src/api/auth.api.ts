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

const authApi = {
  /**
   * POST /auth/signup
   * Sends OTP to the provided email. Does NOT return tokens yet.
   */
  signup: async (payload: SignupPayload): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/signup', payload);
    return data;
  },

  /**
   * POST /auth/verify-email
   * Verifies OTP and returns accessToken + refreshToken.
   */
  verifyOtp: async (payload: VerifyOtpPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/verify-email', payload);
    return data;
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
   * Standard email/password login.
   */
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/login', {
      ...payload,
      platform: payload.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android'),
    });
    return data;
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
    return data;
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
    return data;
  },

  /**
   * GET /auth/me
   * Used in Splash/App init to check token validity and profile status.
   * The client interceptor will auto-inject the Authorization header.
   */
  getMe: async (): Promise<User> => {
    const { data } = await client.get('/auth/me');
    // Normalize: handle nested `user` key if backend wraps it
    return data.user ?? data;
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
