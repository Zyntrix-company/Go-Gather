import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { getArchivedTrips, unarchiveTrip, handleApiError } from '../../api/trips.api';
import { UnifiedCard } from '../../components/common/Cards';

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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return 'TBD';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
}

function mapTrip(t: any): ArchivedTrip {
  const rawS: string = t.startDate ?? '';
  const rawE: string = t.endDate ?? '';
  const s = rawS.includes('T') ? rawS.split('T')[0] : rawS;
  const e = rawE.includes('T') ? rawE.split('T')[0] : rawE;
  return {
    id: t.id,
    name: t.name,
    location: typeof t.location === 'string' ? t.location : (t.location?.name ?? ''),
    startDate: fmtDate(s),
    endDate: fmtDate(e),
    bannerImageUrl: t.bannerImageUrl ?? null,
    memberCount: t.memberCount ?? 1,
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ArchivedTripsScreen() {
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<ArchivedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getArchivedTrips();
      setTrips(data.trips.map(mapTrip));
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnarchive(trip: ArchivedTrip) {
    setOpenMenuId(null);
    Alert.alert(
      'Move to Trips',
      `Restore "${trip.name}" to your trips?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trips',
          onPress: async () => {
            try {
              await unarchiveTrip(trip.id);
              setTrips(prev => prev.filter(t => t.id !== trip.id));
              Toast.show({ type: 'success', text1: 'Restored', text2: `"${trip.name}" moved back to trips.` });
            } catch (err) {
              handleApiError(err);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Trips</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && <Text style={styles.emptyText}>Loading archived trips...</Text>}

        {!loading && trips.length === 0 && (
          <View style={styles.emptyState}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyTitle}>No archived trips</Text>
            <Text style={styles.emptyText}>Trips you archive will appear here.</Text>
          </View>
        )}

        {trips.map(trip => (
          <UnifiedCard
            key={trip.id}
            imageUri={trip.bannerImageUrl}
            name={trip.name}
            location={trip.location}
            dateLabel={`${trip.startDate} – ${trip.endDate}`}
            members={[]}
            extraMembers={trip.memberCount}
            onPress={() => {}}
            onToggleMenu={() => setOpenMenuId(openMenuId === trip.id ? null : trip.id)}
            showMenu={openMenuId === trip.id}
            archiveLabel="Move to Trips"
            onArchive={() => handleUnarchive(trip)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#45556C' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#45556C' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
});
