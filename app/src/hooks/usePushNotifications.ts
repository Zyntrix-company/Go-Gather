import messaging from '@react-native-firebase/messaging';
import { useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import useNotificationStore from '../store/notificationStore';
import notificationsApi from '../api/notifications.api';

async function registerDeviceWithBackend(token: string) {
  try {
    await notificationsApi.registerDevice(token);
  } catch {
    // best-effort — will retry next session
  }
}

export const usePushNotifications = () => {
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);

  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      // iOS: permission is handled by the native module — no JS call needed until
      // APNs cert is added in Firebase console (see plan Phase 2 iOS checklist).

      const token = await messaging().getToken();
      await registerDeviceWithBackend(token);
    };
    setup();

    // FCM rotates tokens periodically — keep the backend in sync
    const unsubRefresh = messaging().onTokenRefresh(async (token) => {
      await registerDeviceWithBackend(token);
    });

    // Foreground: FCM does NOT auto-show system notification — show toast only.
    // Strategy A: do not inject a synthetic-ID row into the local list.
    // The notification is already persisted in DB by the backend; the list will
    // pick it up on next fetch (focus or pull-to-refresh). Badge stays accurate
    // via refreshUnreadCount.
    const unsubMessage = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title ?? '';
      const body  = remoteMessage.notification?.body  ?? '';

      Toast.show({
        type: 'info',
        text1: title,
        text2: body,
        visibilityTime: 4000,
        position: 'top',
      });

      await refreshUnreadCount();
    });

    return () => {
      unsubRefresh();
      unsubMessage();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
