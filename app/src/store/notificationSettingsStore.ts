import { create } from 'zustand';
import notificationSettingsApi, { NotificationSettings } from '../api/notificationSettings.api';

type NotificationSettingsState = {
  settings: NotificationSettings | null;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<NotificationSettings>) => Promise<void>;
};

const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await notificationSettingsApi.getNotificationSettings();
      set({ settings: data.settings, loading: false });
    } catch {
      set({ loading: false, error: 'Could not load settings' });
    }
  },

  updateSettings: async (patch) => {
    const previous = get().settings;
    // Optimistic update
    if (previous) {
      set({ settings: { ...previous, ...patch } });
    }
    try {
      const data = await notificationSettingsApi.updateNotificationSettings(patch);
      set({ settings: data.settings });
    } catch {
      // Revert on error
      set({ settings: previous });
    }
  },
}));

export default useNotificationSettingsStore;
