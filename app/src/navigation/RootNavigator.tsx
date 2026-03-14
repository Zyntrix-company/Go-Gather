import React from 'react';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import useAuthStore from '../store/authStore';

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <AuthStack />;

  return <MainStack />;
}
