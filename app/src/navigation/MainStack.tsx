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
import NotificationSettingsScreen from '../screens/main/NotificationSettingsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import ChangePasswordScreen from '../screens/main/ChangePasswordScreen';
import ConnectedEmailScreen from '../screens/main/ConnectedEmailScreen';
import FaqScreen from '../screens/main/FaqScreen';
import MenuScreen from '../screens/home/MenuScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SupportScreen from '../screens/main/SupportScreen';
import LegalScreen from '../screens/main/LegalScreen';
import PersonalDocumentsScreen from '../screens/main/PersonalDocumentsScreen';

export type MainStackParamList = {
  Home: { initialTab?: string } | undefined;
  EditProfile: undefined;
  Notifications: { initialTab?: 'notifications' | 'requests' } | undefined;
  TripDetail: { trip: any };
  EventDetail: { event: any };
  ChatDetail: {
    conversationId?: string;
    tripContext?: {
      name?: string;
      destination?: string;
      startDate?: string;
      endDate?: string;
      memberCount?: number;
      contextType?: 'trip' | 'event';
    };
    initialMessage?: string;
  };
  Archived: undefined;
  FriendProfile: { userId: string; friendName: string };
  HowItWorks: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  ConnectedEmail: undefined;
  Faq: undefined;
  Menu: undefined;
  Profile: undefined;
  Support: undefined;
  Legal: undefined;
  PersonalDocuments: undefined;
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
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="ConnectedEmail" component={ConnectedEmailScreen} />
      <Stack.Screen name="Faq" component={FaqScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="PersonalDocuments" component={PersonalDocumentsScreen} />
    </Stack.Navigator>
  );
}
