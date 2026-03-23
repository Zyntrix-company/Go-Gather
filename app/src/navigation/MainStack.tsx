import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home/HomeScreen';
import CreateProfileScreen from '../screens/auth/CreateProfileScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import TripDetailScreen from '../screens/main/TripDetailScreen';
import EventDetailScreen from '../screens/main/EventDetailScreen';
import ChatDetailScreen from '../screens/main/ChatDetailScreen';
import ArchivedTripsScreen from '../screens/main/ArchivedTripsScreen';
import useAuthStore from '../store/authStore';

export type MainStackParamList = {
  Home: undefined;
  CreateProfile: undefined;
  Notifications: undefined;
  TripDetail: { trip: any };
  EventDetail: { event: any };
  ChatDetail: { chat: any };
  ArchivedTrips: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  const user = useAuthStore((s) => s.user);

  const initialRouteName = (!user || user.isProfileComplete === false) ? 'CreateProfile' : 'Home';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName as any}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="ArchivedTrips" component={ArchivedTripsScreen} />
    </Stack.Navigator>
  );
}
