import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { getArchivedEvents, unarchiveEvent, deleteEvent, handleApiError } from '../../api/events.api';
import { showConfirm } from '../../store/alertStore';
import { formatLocationsLabel } from '../../utils/locations';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchivedEvent = {
  id: string;
  name: string;
  location: string;
  fullDate: string;
  bannerImageUrl?: string | null;
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ArchivedEventsScreen() {
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function loadArchived(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await getArchivedEvents();
      setEvents(res.events.map(e => ({
        id: e.id,
        name: e.name,
        location: formatLocationsLabel(e),
        fullDate: e.eventDate
          ? new Date(e.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : '',
        bannerImageUrl: e.bannerImageUrl ?? null,
      })));
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadArchived(); }, []));

  function handleUnarchive(event: ArchivedEvent) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Restore Event',
      message: `Restore "${event.name}" to your events?`,
      confirmText: 'Restore',
      onConfirm: async () => {
        try {
          await unarchiveEvent(event.id);
          setEvents(prev => prev.filter(e => e.id !== event.id));
          Toast.show({ type: 'success', text1: 'Restored', text2: `"${event.name}" moved back to events.` });
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function handleDeleteEvent(event: ArchivedEvent) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Delete Event',
      message: `Permanently delete "${event.name}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEvent(event.id);
          setEvents(prev => prev.filter(e => e.id !== event.id));
          Toast.show({ type: 'success', text1: 'Deleted', text2: `"${event.name}" has been deleted.` });
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Events</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setOpenMenuId(null)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadArchived(true); }}
            colors={['#0d9488']}
            tintColor="#0d9488"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 60 }} />
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyTitle}>No archived events</Text>
            <Text style={styles.emptyText}>Events you archive will appear here.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>ARCHIVED EVENTS</Text>
            {events.map(event => (
              <UnifiedCard
                key={event.id}
                imageUri={event.bannerImageUrl}
                name={event.name}
                location={event.location}
                dateLabel={event.fullDate}
                members={[]}
                extraMembers={0}
                onPress={() => {}}
                onToggleMenu={() => setOpenMenuId(openMenuId === event.id ? null : event.id)}
                showMenu={openMenuId === event.id}
                archiveLabel="Restore"
                onArchive={() => handleUnarchive(event)}
                onDelete={() => handleDeleteEvent(event)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#45556C',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#45556C',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
