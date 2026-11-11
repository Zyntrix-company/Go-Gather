import { create } from 'zustand';
import { DEFAULT_APP_LIMITS, fetchAppLimits, type AppLimits } from '../api/appLimits.api';

type AppLimitsState = {
  limits: AppLimits;
  loadLimits: () => Promise<AppLimits>;
};

const useAppLimitsStore = create<AppLimitsState>((set, get) => ({
  limits: DEFAULT_APP_LIMITS,

  loadLimits: async () => {
    try {
      const limits = { ...DEFAULT_APP_LIMITS, ...(await fetchAppLimits()) };
      set({ limits });
      return limits;
    } catch {
      return get().limits;
    }
  },
}));

/** Server-driven text / count caps; falls back to DEFAULT_APP_LIMITS until loaded. */
export default function useAppLimits() {
  return useAppLimitsStore((s) => s.limits);
}

export function loadAppLimits() {
  return useAppLimitsStore.getState().loadLimits();
}
