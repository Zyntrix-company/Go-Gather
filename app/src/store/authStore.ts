import { create } from 'zustand';
import { User } from '../types/user.types';

export type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingProfileSetup: boolean;

  setAuth: (user: User | null, accessToken?: string | null, refreshToken?: string | null) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  setLoading: (val: boolean) => void;
  setPendingProfileSetup: (val: boolean) => void;
};

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  pendingProfileSetup: false,

  setAuth: (user, accessToken, refreshToken) =>
    set({
      user,
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      isAuthenticated: !!accessToken,
    }),

  logout: () =>
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      pendingProfileSetup: false,
    }),

  updateUser: (data) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    })),

  setLoading: (val) => set({ isLoading: val }),

  setPendingProfileSetup: (val) => set({ pendingProfileSetup: val }),
}));

export default useAuthStore;
