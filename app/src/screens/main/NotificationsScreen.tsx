import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import useNotificationStore from '../../store/notificationStore';

// Notification types that live in the Requests tab
const REQUEST_TYPES = ['FRIEND_REQUEST', 'TRIP_MEMBER_ADDED', 'EVENT_MEMBER_ADDED'];

// ── Time helper ───────────────────────────────────────────────────────────────

function getRelativeTime(ts: number | string): string {
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diff = Math.floor((Date.now() - time) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function getReminderIcon(reminderType?: string) {
  if (reminderType === '1_week_before' || reminderType === '3_days_before') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} stroke="#0d9488" strokeWidth={2} />
        <Path d="M12 6v6l4 2" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (reminderType === '1_day_before') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function getNotificationIcon(type: string, data?: Record<string, string>) {
  switch (type) {
    case 'TRIP_REMINDER':
    case 'EVENT_REMINDER':
      return getReminderIcon(data?.reminderType);

    case 'TRIP_CANCELLED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke="#ef4444" strokeWidth={2} />
          <Path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'ITINERARY_UPDATED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'DOCUMENT_UPLOADED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'EXPENSE_ADDED':
    case 'expense_added':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'NEW_MEMBER_JOINED':
    case 'TRIP_MILESTONE':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 4L12 14.01l-3-3" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'trip_invite':
    case 'TRIP_MEMBER_ADDED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'poll_created':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M18 20V10M12 20V4M6 20v-6" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'member_joined':
    case 'EVENT_MEMBER_ADDED':
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'TRIP_INVITE_ACCEPTED':
    case 'EVENT_INVITE_ACCEPTED':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 4L12 14.01l-3-3" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    case 'TRIP_CANCELLED':                        return '#fef2f2';
    case 'EXPENSE_ADDED':
    case 'expense_added':                         return '#fffbeb';
    case 'poll_created':                          return '#eef2ff';
    case 'member_joined':
    case 'EVENT_MEMBER_ADDED':
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':                       return '#ecfdf5';
    case 'DOCUMENT_UPLOADED':                     return '#f8fafc';
    default:                                      return '#f0fdfa';
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'requests'>('notifications');
  const {
    notifications,
    loading,
    hasMore,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  // Refresh list whenever the screen comes into focus so new notifications
  // delivered while the user was elsewhere are visible immediately.
  useFocusEffect(
    useCallback(() => {
      fetchNotifications(true);
    }, [fetchNotifications]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  // Split by type
  const notificationsTabItems = notifications.filter(n => !REQUEST_TYPES.includes(n.type));
  const requestsTabItems      = notifications.filter(n =>  REQUEST_TYPES.includes(n.type));
  const displayed             = activeTab === 'notifications' ? notificationsTabItems : requestsTabItems;

  // Per-tab unread counts
  const notificationsUnread = notificationsTabItems.filter(n => !n.read).length;
  const requestsUnread      = requestsTabItems.filter(n => !n.read).length;
  const activeTabUnread     = activeTab === 'notifications' ? notificationsUnread : requestsUnread;

  const onEndReached = useCallback(() => {
    if (activeTab === 'notifications' && !loading && hasMore) {
      fetchNotifications(false);
    }
  }, [activeTab, loading, hasMore, fetchNotifications]);

  const renderFooter = () => {
    if (!loading || activeTab !== 'notifications') return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0d9488" />
      </View>
    );
  };

  const handleCardPress = (item: any) => {
    markRead(item.id);
    const { type, data } = item;

    // Trip-scoped notifications
    if (data?.tripId && (
      type === 'TRIP_REMINDER' || type === 'TRIP_MEMBER_ADDED' || type === 'TRIP_INVITE_ACCEPTED' ||
      type === 'TRIP_CANCELLED' || type === 'ITINERARY_UPDATED' || type === 'EXPENSE_ADDED' ||
      type === 'NEW_MEMBER_JOINED' || type === 'TRIP_MILESTONE' ||
      (type === 'DOCUMENT_UPLOADED' && data.tripId)
    )) {
      navigation.navigate('TripDetail', { trip: { id: data.tripId } });
      return;
    }

    // Event-scoped notifications (including event document uploads)
    if (data?.eventId && (
      type === 'EVENT_REMINDER' || type === 'EVENT_MEMBER_ADDED' || type === 'EVENT_INVITE_ACCEPTED' ||
      (type === 'DOCUMENT_UPLOADED' && data.eventId)
    )) {
      navigation.navigate('EventDetail', { event: { id: data.eventId } });
      return;
    }

    // FRIEND_REQUEST / FRIEND_ACCEPTED — Accept button handles navigation; card tap = read only
  };

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
          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
            onPress={() => setActiveTab('notifications')}
            activeOpacity={0.8}>
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
                Notifications
              </Text>
              {notificationsUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {notificationsUnread > 99 ? '99+' : notificationsUnread}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
            activeOpacity={0.8}>
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                Requests
              </Text>
              {requestsUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {requestsUnread > 99 ? '99+' : requestsUnread}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Mark all read — active tab only */}
        {activeTabUnread > 0 && (
          <View style={styles.markReadRow}>
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.8}>
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notification list */}
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, displayed.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0d9488"
              colors={['#0d9488']}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'requests' ? 'No requests' : 'No notifications'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'requests' ? 'No pending requests' : 'Nothing here yet'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.notifCardUnread]}
              onPress={() => handleCardPress(item)}
              activeOpacity={0.7}>

              {!item.read && <View style={styles.unreadAccent} />}

              <View style={styles.notifIconWrap}>
                {getNotificationIcon(item.type, item.data)}
              </View>

              <View style={styles.notifContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMessage} numberOfLines={2}>{item.message ?? item.body}</Text>
                <View style={styles.notifMeta}>
                  <Text style={styles.notifTime}>
                    {getRelativeTime(item.receivedAt ?? item.created_at ?? Date.now())}
                  </Text>
                  {(item.data?.tripName || item.data?.eventName) && (
                    <Text style={styles.contextLabel} numberOfLines={1}>
                      {item.data?.tripName ?? item.data?.eventName}
                    </Text>
                  )}
                </View>

                {/* Accept / Decline — FRIEND_REQUEST only */}
                {item.type === 'FRIEND_REQUEST' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => {
                        markRead(item.id);
                        navigation.navigate('FriendProfile', {
                          userId: item.data?.fromUserId ?? item.data?.userId,
                          friendName: item.title,
                        });
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => markRead(item.id)}
                      activeOpacity={0.8}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </BlobBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0f172a',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginHorizontal: 20,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0d9488',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0d9488',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Mark all read
  markReadRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  markReadText: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '500',
  },

  // List
  listContent: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // Notification card
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notifCardUnread: {
    backgroundColor: 'transparent',
  },
  unreadAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#0d9488',
  },
  notifIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
    gap: 8,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    flex: 1,
  },
  notifTitleUnread: {
    color: '#080808',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0d9488',
    flexShrink: 0,
  },
  notifMessage: {
    fontSize: 13,
    color: '#6e7d91',
    lineHeight: 19,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  notifTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '400',
  },
  contextLabel: {
    fontSize: 11,
    color: '#0d9488',
    fontWeight: '500',
    flexShrink: 1,
    marginLeft: 8,
    textAlign: 'right',
  },

  // Accept / Decline action row (FRIEND_REQUEST)
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
