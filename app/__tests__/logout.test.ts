import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// axios ships ESM that this jest setup doesn't transform; client.ts only needs the shape.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }, defaults: { headers: { common: {} } } }),
    post: jest.fn(),
  },
}));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@react-native-firebase/messaging', () => () => ({ getToken: jest.fn().mockResolvedValue('fcm') }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { signOut: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../src/api/notifications.api', () => ({ __esModule: true, default: { registerDevice: jest.fn() } }));
jest.mock('../src/api/auth.api', () => ({
  __esModule: true,
  default: { getMe: jest.fn(), logout: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../src/utils/storage', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(), getRefreshToken: jest.fn(), setToken: jest.fn(), setRefreshToken: jest.fn(),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

import authApi from '../src/api/auth.api';
import storage from '../src/utils/storage';
import useAuth from '../src/hooks/useAuth';
import useAuthStore from '../src/store/authStore';

const mockedApi = authApi as jest.Mocked<typeof authApi>;
const mockedStorage = storage as jest.Mocked<typeof storage>;

function mountAuth() {
  let auth!: ReturnType<typeof useAuth>;
  const Probe = () => { auth = useAuth(); return null; };
  act(() => { TestRenderer.create(React.createElement(Probe)); });
  return () => auth;
}

const flush = () => new Promise<void>((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.getToken.mockResolvedValue('access-1');
  mockedStorage.getRefreshToken.mockResolvedValue('refresh-1');
  useAuthStore.getState().setAuth({ id: 'u1' } as any, 'access-1', 'refresh-1');
});

describe('logout', () => {
  it('flips the auth state before any storage or network work finishes', async () => {
    // Keychain and the server both hang — the screen must still change.
    mockedStorage.getRefreshToken.mockReturnValue(new Promise(() => {}));
    mockedStorage.getToken.mockReturnValue(new Promise(() => {}));
    const auth = mountAuth();

    act(() => { void auth().logout(); }); // no await: only the synchronous part has run
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('is not undone by a profile fetch that was already in flight', async () => {
    let resolveMe!: (u: any) => void;
    mockedApi.getMe.mockReturnValue(new Promise((r) => { resolveMe = r; }));
    const auth = mountAuth();

    const pending = auth().refreshProfile(); // e.g. Menu screen focus
    await flush();
    await act(async () => { await auth().logout(); });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    await act(async () => { resolveMe({ id: 'u1', isProfileComplete: true }); await pending; });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('revokes the Keychain refresh token in the background and clears storage', async () => {
    const auth = mountAuth();
    await act(async () => { await auth().logout(); });
    expect(mockedStorage.clearAll).toHaveBeenCalledTimes(1);
    expect(mockedApi.logout).toHaveBeenCalledWith('refresh-1', 'access-1');
  });

  it('does not wipe the Keychain if someone signed in again meanwhile', async () => {
    let releaseRefresh!: (v: string) => void;
    mockedStorage.getRefreshToken.mockReturnValue(new Promise((r) => { releaseRefresh = r; }));
    mockedApi.getMe.mockResolvedValue({ id: 'u2' } as any);
    (authApi as any).login = jest.fn().mockResolvedValue({ user: { id: 'u2' }, accessToken: 'a2', refreshToken: 'r2' });
    const auth = mountAuth();

    const out = auth().logout();
    await flush();
    await act(async () => { await auth().login('b@x.com', 'pw'); });
    await act(async () => { releaseRefresh('refresh-1'); await out; });

    expect(mockedStorage.clearAll).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
