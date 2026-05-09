import { create } from 'zustand';
import notificationSettingsApi, { NotificationSettings } from '../api/notificationSettings.api';

type NotificationSettingsState = {
  settings: NotificationSettings | null;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<NotificationSettings>) => Promise<void>;
};

/** Merges API JSON with defaults so toggles and pills always have defined values (older rows may have partial JSON). */
function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotificationSettings>;
  const digest = r.email_digest;
  return {
    email_digest:
      digest === 'daily' || digest === 'weekly' || digest === 'never' ? digest : 'daily',
    lock_screen_reminders:
      typeof r.lock_screen_reminders === 'boolean' ? r.lock_screen_reminders : true,
    quiet_hours_enabled:
      typeof r.quiet_hours_enabled === 'boolean' ? r.quiet_hours_enabled : true,
    quiet_start: typeof r.quiet_start === 'string' && r.quiet_start ? r.quiet_start : '22:00',
    quiet_end: typeof r.quiet_end === 'string' && r.quiet_end ? r.quiet_end : '08:00',
  };
}

const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await notificationSettingsApi.getNotificationSettings();
      set({ settings: normalizeNotificationSettings(data.settings), loading: false });
    } catch {
      set({ loading: false, error: 'Could not load settings' });
    }
  },

  updateSettings: async (patch) => {
    const previous = get().settings;
    // Optimistic update
    if (previous) {
      set({ settings: normalizeNotificationSettings({ ...previous, ...patch }) });
    }
    try {
      const data = await notificationSettingsApi.updateNotificationSettings(patch);
      set({ settings: normalizeNotificationSettings(data.settings) });
    } catch {
      // Revert on error
      set({ settings: previous });
    }
  },
}));

export default useNotificationSettingsStore;
