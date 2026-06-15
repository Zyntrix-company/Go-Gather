/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered before AppRegistry — handles FCM messages when app is background/killed.
// The system notification is shown automatically by FCM; no action needed here.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);
