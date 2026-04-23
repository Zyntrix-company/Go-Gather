import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  receivedAt: number;
  read: boolean;
  data?: Record<string, string>;
};

type NotificationState = {
  notifications: AppNotification[];
  addNotification: (n: Pick<AppNotification, 'type' | 'title' | 'message' | 'data'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
};

const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],

      addNotification: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: Date.now().toString(),
              receivedAt: Date.now(),
              read: false,
              data: n.data,
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

      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'gathergo-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useNotificationStore;
