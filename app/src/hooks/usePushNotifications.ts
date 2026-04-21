import messaging from '@react-native-firebase/messaging';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import useNotificationStore from '../store/notificationStore';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      const token = await messaging().getToken();
      setFcmToken(token);
    };
    setup();

    // Foreground: FCM does NOT auto-show system notification — handle manually
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title ?? '';
      const body  = remoteMessage.notification?.body  ?? '';
      const type  = (remoteMessage.data?.type as string) ?? 'default';
      const data  = remoteMessage.data as Record<string, string> | undefined;

      // Store in in-app notification screen
      addNotification({ type, title, message: body, data });

      // Show toast so user sees it while app is open
      Toast.show({
        type: 'info',
        text1: title,
        text2: body,
        visibilityTime: 4000,
        position: 'top',
      });
    });

    return unsubscribe;
  }, [addNotification]);

  return { fcmToken };
};
