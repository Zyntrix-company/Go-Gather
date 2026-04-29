import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home/HomeScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import TripDetailScreen from '../screens/trips/TripDetailScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import ChatDetailScreen from '../screens/main/ChatDetailScreen';
import ArchivedScreen from '../screens/home/ArchivedScreen';
import FriendProfileScreen from '../screens/main/FriendProfileScreen';
import HowItWorksScreen from '../screens/home/HowItWorksScreen';

export type MainStackParamList = {
  Home: { initialTab?: string } | undefined;
  EditProfile: undefined;
  Notifications: undefined;
  TripDetail: { trip: any };
  EventDetail: { event: any };
  ChatDetail: { chat: any };
  Archived: undefined;
  FriendProfile: { userId: string; friendName: string };
  HowItWorks: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="Archived" component={ArchivedScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="HowItWorks" component={HowItWorksScreen} />
    </Stack.Navigator>
  );
}
