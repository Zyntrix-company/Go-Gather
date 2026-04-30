import client from './client';

export type NotificationSettings = {
  email_digest: 'daily' | 'weekly' | 'never';
  lock_screen_reminders: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
};

export type NotificationSettingsResponse = {
  settings: NotificationSettings;
  timezone: string;
};

const notificationSettingsApi = {
  getNotificationSettings: async (): Promise<NotificationSettingsResponse> => {
    const res = await client.get('/users/notification-settings');
    return res.data;
  },

  updateNotificationSettings: async (
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettingsResponse> => {
    const res = await client.patch('/users/notification-settings', patch);
    return res.data;
  },
};

export default notificationSettingsApi;
