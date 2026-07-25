const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_refresh_token');
}

/** Persists both halves of a token pair returned by /auth/login or /auth/refresh. */
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('admin_token', accessToken);
  if (refreshToken) localStorage.setItem('admin_refresh_token', refreshToken);
}

/** @deprecated use setTokens — kept for call sites that only ever had an access token. */
export function setToken(token) {
  localStorage.setItem('admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_role');
}

/** 'full' | 'content' | null. Cached from GET /admin/me after login so the sidebar can filter without a round trip. */
export function getAdminRole() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_role');
}

export function setAdminRole(role) {
  localStorage.setItem('admin_role', role);
}

/** Calls the real logout endpoint so the refresh token is invalidated server-side, then clears local storage. */
export async function logoutAndClearSession() {
  const refreshToken = getRefreshToken();
  const token = getToken();
  if (refreshToken && token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* best-effort — still clear local session below */ }
  }
  clearToken();
}

// Access tokens are short-lived (15m). Concurrent 401s share one refresh attempt
// instead of each firing their own /auth/refresh call.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(path, options = {}) {
  const doFetch = () => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    };
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let res = await doFetch();

  // 401 = expired/invalid access token — try one silent refresh before giving up.
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return null;
    }
  }

  // Still 401 after a successful-looking refresh, or refresh itself failed silently — bail out.
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return res;
}

export async function apiJSON(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try { message = JSON.parse(text).message || JSON.parse(text).error || text; } catch { /* not JSON */ }
    const err = new Error(message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}
