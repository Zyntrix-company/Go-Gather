import { Platform } from 'react-native';
import client from './client';
import { AppNotification } from '../store/notificationStore';

export type NotificationsPage = {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  hasMore: boolean;
};

const notificationsApi = {
  getNotifications: async (page = 1): Promise<NotificationsPage> => {
    const res = await client.get('/notifications', { params: { page } });
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await client.get('/notifications/unread-count');
    return res.data.unreadCount;
  },

  markRead: async (id: string): Promise<void> => {
    await client.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await client.patch('/notifications/read-all');
  },

  registerDevice: async (deviceToken: string): Promise<void> => {
    await client.patch('/users/device', {
      deviceToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  },
};

export default notificationsApi;
