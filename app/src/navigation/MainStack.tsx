import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home/HomeScreen';
import CreateProfileScreen from '../screens/auth/CreateProfileScreen';
import useAuthStore from '../store/authStore';

export type MainStackParamList = {
  Home: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  const user = useAuthStore((s) => s.user);
  
  // If the user hasn't finished their profile, landing them on 'Profile' forces completion.
  const initialRouteName = (!user || user.isProfileComplete === false) ? 'Profile' : 'Home';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName as any}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={CreateProfileScreen} />
    </Stack.Navigator>
  );
}
