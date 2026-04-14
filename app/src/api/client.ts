/**
 * Axios API client with:
 *  - Authorization header injection (skipped for public auth routes)
 *  - Automatic token refresh on 401 (only for protected endpoints)
 *  - Global error handling (clear tokens on unrecoverable 401)
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Toast from 'react-native-toast-message';
import storage from '../utils/storage';
import useAuthStore from '../store/authStore';

// ─── Base URL ────────────────────────────────────────────────────────────────
const REAL_BASE_URL = 'https://api.gatherrgo.com';
export const API_BASE = REAL_BASE_URL;

// ─── Public routes that do NOT have / need auth tokens ───────────────────────
// 401 on these routes = wrong credentials, NOT expired session.
// We must NOT attempt a token refresh for these endpoints.
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/verify-email',
  '/auth/resend-otp',
  '/auth/google',
  '/auth/facebook',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
];

function isPublicRoute(url: string | undefined): boolean {
  if (!url) return false;
  return PUBLIC_ROUTES.some((route) => url.includes(route));
}

// ─── Axios Client ─────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Inject access token on protected routes ─────────────
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Don't inject token on public routes
    if (!isPublicRoute(config.url)) {
      // Primary: read from secure storage (Keychain)
      let token = await storage.getToken();
      // Fallback: use in-memory store in case Keychain read fails (e.g. Android timing issue)
      if (!token) {
        token = useAuthStore.getState().accessToken;
      }
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Flag to prevent infinite refresh loops ───────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  pendingQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  pendingQueue = [];
}

// ─── Response Interceptor: Handle 401 with token refresh ─────────────────────
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ── Only attempt token refresh for PROTECTED routes ──────────────────────
    // For public routes (login, signup, etc.) a 401 means wrong credentials.
    // We must pass that error through so the UI can show the real message.
    const isProtectedRoute = !isPublicRoute(originalRequest?.url);

    if (error.response?.status === 401 && !originalRequest._retry && isProtectedRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(client(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Primary: read from secure storage; fallback to in-memory store
        let refreshToken = await storage.getRefreshToken();
        if (!refreshToken) {
          refreshToken = useAuthStore.getState().refreshToken;
        }
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        const newAccessToken: string = data.accessToken;
        const newRefreshToken: string = data.refreshToken ?? refreshToken;

        await storage.setToken(newAccessToken);
        await storage.setRefreshToken(newRefreshToken);

        client.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await storage.clearAll();

        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please log in again.',
        });

        useAuthStore.getState().logout();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Global error handling (No more blocking toasts, just logs) ────────────
    if (error.response) {
      console.error(`[API Error ${error.response.status}]:`, error.response.data);
    } else if (error.request) {
      console.error('[Network Error]: No response received from server.');
      console.error('[Network Error] URL:', error.config?.baseURL, error.config?.url);
      console.error('[Network Error] Code:', (error as any).code);
      console.error('[Network Error] Message:', error.message);
    } else {
      console.error('[Client Error]:', error.message);
    }

    return Promise.reject(error);
  },
);

function getErrorTitle(status: number): string {
  switch (status) {
    case 400: return 'Invalid Request';
    case 401: return 'Login Failed';
    case 403: return 'Access Denied';
    case 404: return 'Not Found';
    case 409: return 'Account Exists';
    case 422: return 'Validation Error';
    case 429: return 'Too Many Requests';
    case 500:
    case 502:
    case 503: return 'Server Error';
    default: return 'Error';
  }
}

export default client;
