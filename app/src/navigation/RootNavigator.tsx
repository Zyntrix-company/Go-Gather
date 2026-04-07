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
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) return <AuthStack />;
  // Show profile setup if explicitly pending OR if user exists but profile isn't complete.
  // Checking isProfileComplete directly prevents the Main screen flash that occurs
  // when setAuth() fires before setPendingProfileSetup(true) in the signup/social flows.
  if (pendingProfileSetup || (user && user.isProfileComplete === false)) return <ProfileSetupNavigator />;

  return <MainStack />;
}
