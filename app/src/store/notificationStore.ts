import { create } from 'zustand';
import notificationsApi from '../api/notifications.api';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  // 'message' kept for backwards compat with foreground-push path
  message?: string;
  receivedAt?: number;
  read: boolean;
  data?: Record<string, string>;
  created_at?: string;
};

type NotificationState = {
  notifications: AppNotification[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  unreadCount: number;

  // Called on app startup or pull-to-refresh — replaces the list
  fetchNotifications: (reset?: boolean) => Promise<void>;
  // Called by FCM foreground handler — prepends in real-time
  addNotification: (n: Pick<AppNotification, 'type' | 'title' | 'body' | 'message' | 'data'>) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  clearNotifications: () => void;
};

const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  page: 1,
  hasMore: true,
  loading: false,
  unreadCount: 0,

  fetchNotifications: async (reset = false) => {
    const { page, loading, hasMore } = get();
    if (loading) return;
    if (!reset && !hasMore) return;

    const nextPage = reset ? 1 : page;
    set({ loading: true });

    try {
      const data = await notificationsApi.getNotifications(nextPage);
      // Normalize: API returns `body`; foreground FCM uses `message`. Unify both.
      const normalized = data.notifications.map((n) => ({ ...n, message: n.body }));
      set((state) => ({
        notifications: reset
          ? normalized
          : [...state.notifications, ...normalized],
        page: data.page + 1,
        hasMore: data.hasMore,
        unreadCount: data.unreadCount,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  addNotification: (n) =>
    set((state) => ({
      notifications: [
        {
          ...n,
          id: Date.now().toString(),
          read: false,
          receivedAt: Date.now(),
        },
        ...state.notifications,
      ],
      unreadCount: state.unreadCount + 1,
    })),

  markRead: async (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      await notificationsApi.markRead(id);
    } catch { /* optimistic — ignore API failures */ }
  },

  markAllRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await notificationsApi.markAllRead();
    } catch { /* optimistic — ignore API failures */ }
  },

  refreshUnreadCount: async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      set({ unreadCount: count });
    } catch { /* non-critical */ }
  },

  clearNotifications: () => set({ notifications: [], page: 1, hasMore: true, unreadCount: 0 }),
}));

export default useNotificationStore;
