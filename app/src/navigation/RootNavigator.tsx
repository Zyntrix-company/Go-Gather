import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import CreateProfileScreen from '../screens/auth/CreateProfileScreen';
import useAuthStore from '../store/authStore';

const SetupStack = createNativeStackNavigator();

function ProfileSetupNavigator() {
  return (
    <SetupStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <SetupStack.Screen name="CreateProfile" component={CreateProfileScreen} />
    </SetupStack.Navigator>
  );
}

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pendingProfileSetup = useAuthStore((s) => s.pendingProfileSetup);

  if (!isAuthenticated) return <AuthStack />;
  if (pendingProfileSetup) return <ProfileSetupNavigator />;

  return <MainStack />;
}
