import * as Keychain from 'react-native-keychain';

const ACCESS_TOKEN_KEY = 'gg_access_token';
const REFRESH_TOKEN_KEY = 'gg_refresh_token';

const storage = {
  // ─── Access Token ──────────────────────────────────────────────────────────
  setToken: async (token: string) => {
    try {
      await Keychain.setGenericPassword('token', token, { service: ACCESS_TOKEN_KEY });
    } catch {
      // noop
    }
  },

  getToken: async (): Promise<string | null> => {
    try {
      const creds = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_KEY });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  },

  removeToken: async () => {
    try {
      await Keychain.resetGenericPassword({ service: ACCESS_TOKEN_KEY });
    } catch {
      // noop
    }
  },

  // ─── Refresh Token ─────────────────────────────────────────────────────────
  setRefreshToken: async (token: string) => {
    try {
      await Keychain.setGenericPassword('refresh', token, { service: REFRESH_TOKEN_KEY });
    } catch {
      // noop
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      const creds = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_KEY });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  },

  removeRefreshToken: async () => {
    try {
      await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY });
    } catch {
      // noop
    }
  },

  // ─── Clear All ─────────────────────────────────────────────────────────────
  clearAll: async () => {
    await storage.removeToken();
    await storage.removeRefreshToken();
  },
};

export default storage;
