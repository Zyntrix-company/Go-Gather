import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';

const NOTIFICATIONS = [
  {
    id: '1',
    type: 'trip_invite',
    title: 'Trip Invitation',
    message: 'Alex invited you to join "Goa Birthday Trip"',
    time: '2 min ago',
    read: false,
  },
  {
    id: '2',
    type: 'expense_added',
    title: 'New Expense',
    message: 'Sam added ₹1,200 for "Hotel booking" in Goa Birthday Trip',
    time: '1 hour ago',
    read: false,
  },
  {
    id: '3',
    type: 'poll_created',
    title: 'New Poll',
    message: 'A new poll was created in Spring Music Festival: "Which day works best?"',
    time: '3 hours ago',
    read: true,
  },
  {
    id: '4',
    type: 'member_joined',
    title: 'Member Joined',
    message: 'Priya joined your trip "Goa Birthday Trip"',
    time: '5 hours ago',
    read: true,
  },
  {
    id: '5',
    type: 'reminder',
    title: 'Trip Reminder',
    message: 'Your trip "Goa Birthday Trip" is in 63 days. Start planning!',
    time: '1 day ago',
    read: true,
  },
  {
    id: '6',
    type: 'document_uploaded',
    title: 'Document Uploaded',
    message: 'Alex uploaded "Flight_Tickets.pdf" to Goa Birthday Trip',
    time: '2 days ago',
    read: true,
  },
  {
    id: '7',
    type: 'trip_invite',
    title: 'Trip Invitation',
    message: 'Jordan invited you to "Winter Ski Trip in Manali"',
    time: '3 days ago',
    read: true,
  },
  {
    id: '8',
    type: 'expense_added',
    title: 'Expense Settled',
    message: 'Sam marked ₹600 as settled in Spring Music Festival',
    time: '4 days ago',
    read: true,
  },
];

function getNotificationIcon(type: string) {
  switch (type) {
    case 'trip_invite':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'expense_added':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'poll_created':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M18 20V10M12 20V4M6 20v-6" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'member_joined':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'reminder':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke="#0d9488" strokeWidth={2} />
          <Path d="M12 6v6l4 2" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
  }
}

function getIconBg(type: string) {
  switch (type) {
    case 'trip_invite': return '#f0fdfa';
    case 'expense_added': return '#fffbeb';
    case 'poll_created': return '#eef2ff';
    case 'member_joined': return '#ecfdf5';
    case 'reminder': return '#f0fdfa';
    default: return '#f8fafc';
  }
}

export default function NotificationsScreen({ navigation }: any) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 70 }} />
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.8}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
            onPress={() => setFilter('unread')}
            activeOpacity={0.8}>
            <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notification List */}
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.notifCardUnread]}
              onPress={() => markRead(item.id)}
              activeOpacity={0.8}>
              <View style={[styles.notifIconWrap, { backgroundColor: getIconBg(item.type) }]}>
                {getNotificationIcon(item.type)}
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  markAllText: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '500',
    width: 70,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: {
    backgroundColor: '#0d9488',
  },
  filterText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  notifCardUnread: {
    // highlight unread via the dot only — no border or background
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0d9488',
  },
  notifMessage: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
