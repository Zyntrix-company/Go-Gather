import { create } from 'zustand';

export type PendingInvite = { type: 'trip' | 'event' | 'friend'; token: string };

type PendingInviteState = {
  pendingInvite: PendingInvite | null;
  setPendingInvite: (invite: PendingInvite | null) => void;
};

const usePendingInviteStore = create<PendingInviteState>((set) => ({
  pendingInvite: null,
  setPendingInvite: (pendingInvite) => set({ pendingInvite }),
}));

export default usePendingInviteStore;
