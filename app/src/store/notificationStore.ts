import { create } from 'zustand';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  receivedAt: number;
  read: boolean;
};

type NotificationState = {
  notifications: AppNotification[];
  addNotification: (n: Pick<AppNotification, 'type' | 'title' | 'message'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (n) =>
    set((state) => ({
      notifications: [
        {
          ...n,
          id: Date.now().toString(),
          receivedAt: Date.now(),
          read: false,
        },
        ...state.notifications,
      ],
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
}));

export default useNotificationStore;
