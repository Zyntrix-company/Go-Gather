import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {
  getArchivedTrips,
  unarchiveTrip,
  handleApiError,
} from '../../api/trips.api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ArchivedTrip = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  bannerImageUrl?: string | null;
  memberCount: number;
};

// ─── Date helpers ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    load();
  }, []);

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Trips</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <Text style={styles.emptyText}>Loading archived trips...</Text>
        )}

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
          <View key={trip.id} style={styles.card}>
            {/* Banner / placeholder */}
            {trip.bannerImageUrl ? (
              <Image source={{ uri: trip.bannerImageUrl }} style={styles.banner} resizeMode="cover" />
            ) : (
              <View style={[styles.banner, styles.bannerPlaceholder]}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            )}

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{trip.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{trip.location}</Text>
                <Text style={styles.cardMeta}>{trip.startDate} – {trip.endDate}</Text>
              </View>

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleUnarchive(trip)}
                activeOpacity={0.8}>
                <Text style={styles.restoreBtnText}>Move to Trips</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
    color: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  banner: {
    width: '100%',
    height: 120,
  },
  bannerPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  restoreBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restoreBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
