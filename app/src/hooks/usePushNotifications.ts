import messaging from '@react-native-firebase/messaging';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

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
  }, []);

  return { fcmToken };
};
