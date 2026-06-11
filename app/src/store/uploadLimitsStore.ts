import { create } from 'zustand';
import { DEFAULT_UPLOAD_LIMITS, fetchUploadLimits, type UploadLimits } from '../api/uploadLimits.api';

type UploadLimitsState = {
  limits: UploadLimits;
  loaded: boolean;
  setLimits: (limits: UploadLimits) => void;
  loadLimits: () => Promise<UploadLimits>;
};

const useUploadLimitsStore = create<UploadLimitsState>((set, get) => ({
  limits: DEFAULT_UPLOAD_LIMITS,
  loaded: false,

  setLimits: (limits) => set({ limits, loaded: true }),

  loadLimits: async () => {
    try {
      const limits = await fetchUploadLimits();
      set({ limits, loaded: true });
      return limits;
    } catch {
      const fallback = get().limits ?? DEFAULT_UPLOAD_LIMITS;
      set({ limits: fallback, loaded: false });
      return fallback;
    }
  },
}));

export default useUploadLimitsStore;
