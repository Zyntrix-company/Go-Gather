import AsyncStorage from '@react-native-async-storage/async-storage';
import usePendingInviteStore from '../src/store/pendingInviteStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const KEY = 'pendingInvite';
const TOKEN = '3f2b8c1e-9a47-4d6e-b1f0-5c7a2e9d4b10';
const DAY = 24 * 3600 * 1000;

beforeEach(async () => {
  await AsyncStorage.clear();
  usePendingInviteStore.setState({ pendingInvite: null });
});

describe('pendingInviteStore persistence', () => {
  it('stashes an invite so it survives the app being killed', async () => {
    usePendingInviteStore.getState().setPendingInvite({ type: 'friend', token: TOKEN });
    await new Promise(setImmediate);

    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    expect(saved).toMatchObject({ type: 'friend', token: TOKEN });

    usePendingInviteStore.setState({ pendingInvite: null }); // simulate a fresh process
    await usePendingInviteStore.getState().hydratePendingInvite();
    expect(usePendingInviteStore.getState().pendingInvite).toEqual({ type: 'friend', token: TOKEN });
  });

  it('forgets the stash once the invite is consumed', async () => {
    usePendingInviteStore.getState().setPendingInvite({ type: 'trip', token: TOKEN });
    usePendingInviteStore.getState().setPendingInvite(null);
    await new Promise(setImmediate);

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('drops a stash older than the invite lifetime', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ type: 'event', token: TOKEN, savedAt: Date.now() - 8 * DAY }));

    await usePendingInviteStore.getState().hydratePendingInvite();

    expect(usePendingInviteStore.getState().pendingInvite).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('ignores a corrupt or unknown-type stash', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ type: 'group', token: TOKEN, savedAt: Date.now() }));
    await usePendingInviteStore.getState().hydratePendingInvite();
    expect(usePendingInviteStore.getState().pendingInvite).toBeNull();

    await AsyncStorage.setItem(KEY, '{not json');
    await usePendingInviteStore.getState().hydratePendingInvite();
    expect(usePendingInviteStore.getState().pendingInvite).toBeNull();
  });

  it('keeps a link tapped since launch over the stashed one', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ type: 'event', token: 'old', savedAt: Date.now() }));
    usePendingInviteStore.setState({ pendingInvite: { type: 'friend', token: TOKEN } });

    await usePendingInviteStore.getState().hydratePendingInvite();

    expect(usePendingInviteStore.getState().pendingInvite).toEqual({ type: 'friend', token: TOKEN });
  });
});
