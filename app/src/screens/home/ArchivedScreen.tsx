import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import BlobBackground from '../../components/common/BlobBackground';
import { BackIcon } from '../../components/common/Icons';
import {
  getArchivedTrips,
  unarchiveTrip,
  handleApiError,
} from '../../api/trips.api';
import { getArchivedEvents, unarchiveEvent } from '../../api/events.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchivedTrip = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  bannerImageUrl?: string | null;
  memberCount: number;
};

type ArchivedEvent = {
  id: string;
  name: string;
  location: string;
  fullDate: string;
  bannerImageUrl?: string | null;
};

// ─── Date helpers ────────────────────────────────────────────────────────────

function fmtDateTrip(iso: string): string {
  if (!iso) return 'TBD';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ArchivedScreen() {
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<ArchivedTrip[]>([]);
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadArchived(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [tripsRes, eventsRes] = await Promise.all([
        getArchivedTrips(),
        getArchivedEvents(),
      ]);

      setTrips((tripsRes.trips || []).map(t => ({
        id: t.id,
        name: t.name,
        location: t.location?.name ?? '',
        startDate: fmtDateTrip(t.startDate),
        endDate: fmtDateTrip(t.endDate),
        bannerImageUrl: t.bannerImageUrl,
        memberCount: t.memberCount ?? 0,
      })));

      setEvents((eventsRes.events || []).map(e => ({
        id: e.id,
        name: e.name,
        location: e.location?.name ?? '',
        fullDate: e.eventDate
          ? new Date(e.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : '',
        bannerImageUrl: null,
      })));
    } catch (err) {
      handleApiError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadArchived();
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadArchived(true);
    setRefreshing(false);
  }

  function handleUnarchiveTrip(trip: ArchivedTrip) {
    Alert.alert('Restore Trip', `Restore "${trip.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await unarchiveTrip(trip.id);
            toast('Restored', `"${trip.name}" restored.`);
            setTrips(p => p.filter(t => t.id !== trip.id));
          } catch (err) {
            handleApiError(err);
          }
        },
      },
    ]);
  }

  function handleUnarchiveEvent(event: ArchivedEvent) {
    Alert.alert('Restore Event', `Restore "${event.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await unarchiveEvent(event.id);
            toast('Restored', `"${event.name}" restored.`);
            setEvents(p => p.filter(e => e.id !== event.id));
          } catch (err) {
            handleApiError(err);
          }
        },
      },
    ]);
  }

  function toast(title: string, msg: string) {
    Toast.show({ type: 'success', text1: title, text2: msg });
  }

  if (loading) {
    return (
      <BlobBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.backRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <BackIcon />
            </TouchableOpacity>
            <Text style={styles.title}>Archived</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        </SafeAreaView>
      </BlobBackground>
    );
  }

  const isEmpty = trips.length === 0 && events.length === 0;

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.title}>Archived</Text>
        </View>

        {isEmpty ? (
          <View style={styles.emptyCenter}>
            <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7h16M8 4h8M6 7l.937 11.265A2 2 0 008.91 20h6.18a2 2 0 001.973-1.735L18 7M9 11v6M15 11v6"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.emptyTitle}>No archived items</Text>
            <Text style={styles.emptySub}>Archived trips and events will appear here</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />}
          >
            {/* Archived Trips Section */}
            {trips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archived Trips</Text>
                {trips.map(trip => (
                  <View key={trip.id} style={styles.itemCard}>
                    <View style={styles.itemImageWrapper}>
                      {trip.bannerImageUrl ? (
                        <Image
                          source={{ uri: trip.bannerImageUrl }}
                          style={styles.itemImage}
                          resizeMode="cover"
                          onError={() => {}}
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M21 10c0-7-3-10-9-10S3 3 3 10m0 4v6a2 2 0 002 2h14a2 2 0 002-2v-6M7 15l2-2 2 2 2-2 2 2 2-2 2 2"
                              stroke="#cbd5e1"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        </View>
                      )}
                    </View>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>{trip.name}</Text>
                      <Text style={styles.itemMeta}>{trip.location}</Text>
                      <Text style={styles.itemMeta}>
                        {trip.startDate} - {trip.endDate}
                      </Text>
                      <Text style={styles.itemMeta}>{trip.memberCount} member{trip.memberCount !== 1 ? 's' : ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => handleUnarchiveTrip(trip)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.restoreBtnText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Archived Events Section */}
            {events.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archived Events</Text>
                {events.map(event => (
                  <View key={event.id} style={styles.itemCard}>
                    <View style={styles.itemImageWrapper}>
                      {event.bannerImageUrl ? (
                        <Image
                          source={{ uri: event.bannerImageUrl }}
                          style={styles.itemImage}
                          resizeMode="cover"
                          onError={() => {}}
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M4 9h16M4 9a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
                              stroke="#cbd5e1"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        </View>
                      )}
                    </View>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>{event.name}</Text>
                      <Text style={styles.itemMeta}>{event.location}</Text>
                      <Text style={styles.itemMeta}>{event.fullDate}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => handleUnarchiveEvent(event)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.restoreBtnText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginLeft: 12 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3 },

  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  itemImageWrapper: { width: 80, height: 80 },
  itemImage: { width: 80, height: 80 },
  itemImagePlaceholder: { width: 80, height: 80, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  itemContent: { flex: 1, paddingHorizontal: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  itemMeta: { fontSize: 12, color: '#64748b', marginBottom: 2 },

  restoreBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f0fdfa', borderRadius: 8, marginRight: 8 },
  restoreBtnText: { fontSize: 12, color: '#0d9488', fontWeight: '600' },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#64748b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});
