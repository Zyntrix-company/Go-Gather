/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Geolocation from '@react-native-community/geolocation';
import Toast from 'react-native-toast-message';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Configure geolocation to use native Android location provider
Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });

function App() {
  usePushNotifications();

  useEffect(() => {
    // TODO: replace with actual webClientId from Google Cloud console
    try {
      GoogleSignin.configure({
        webClientId: '444293164368-8rjq9b60t2kcbers0d77j4lic7oma5nl.apps.googleusercontent.com',
        iosClientId: '444293164368-62ticnka5jbe7phea60phv6otd69nkbe.apps.googleusercontent.com',
        offlineAccess: false,
        scopes: ['https://www.googleapis.com/auth/user.birthday.read'],
      });
    } catch (e) {
      // noop during scaffold
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={{ dark: false, colors: { primary: '#0d9488', background: 'transparent', card: 'transparent', text: '#0f172a', border: 'transparent', notification: '#0d9488' }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '900' } } }}>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
        <Toast />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
