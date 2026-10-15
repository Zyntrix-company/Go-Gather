import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingInvite = { type: 'trip' | 'event' | 'friend'; token: string };

const STORAGE_KEY = 'pendingInvite';
// Matches the server-side invite lifetime; an older stash can only be dead weight.
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

type PendingInviteState = {
  pendingInvite: PendingInvite | null;
  setPendingInvite: (invite: PendingInvite | null) => void;
  /** Restores an invite stashed before the app was killed (e.g. mid sign-up). */
  hydratePendingInvite: () => Promise<void>;
};

// Persisted so an invite survives the app being killed during sign-up / OAuth, and so the
// one-shot Play Install Referrer is not lost with it. Storage is best-effort throughout.
function persist(invite: PendingInvite | null) {
  const write = invite
    ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...invite, savedAt: Date.now() }))
    : AsyncStorage.removeItem(STORAGE_KEY);
  write.catch(() => {});
}

const usePendingInviteStore = create<PendingInviteState>((set, get) => ({
  pendingInvite: null,
  setPendingInvite: (pendingInvite) => {
    set({ pendingInvite });
    persist(pendingInvite);
  },
  hydratePendingInvite: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const fresh = typeof saved?.savedAt === 'number' && Date.now() - saved.savedAt < MAX_AGE_MS;
      const valid = ['trip', 'event', 'friend'].includes(saved?.type) && typeof saved?.token === 'string';
      if (!fresh || !valid) {
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        return;
      }
      // A link tapped since launch wins over the stashed one.
      if (!get().pendingInvite) set({ pendingInvite: { type: saved.type, token: saved.token } });
    } catch {
      // unreadable storage: carry on without it
    }
  },
}));

export default usePendingInviteStore;
