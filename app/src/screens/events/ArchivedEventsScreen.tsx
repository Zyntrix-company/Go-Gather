import React, { useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchivedEvent = {
  id: string;
  name: string;
  location: string;
  fullDate: string;
  image?: any;
  bannerImageUrl?: string | null;
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ArchivedEventsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // events are passed in via route params (from EventListScreen)
  const [events, setEvents] = useState<ArchivedEvent[]>(route?.params?.archivedEvents ?? []);

  function handleUnarchive(event: ArchivedEvent) {
    Alert.alert(
      'Restore Event',
      `Move "${event.name}" back to your events?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            setEvents(prev => prev.filter(e => e.id !== event.id));
            Toast.show({ type: 'success', text1: 'Restored', text2: `"${event.name}" moved back to events.` });
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
        <Text style={styles.headerTitle}>Archived Events</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyTitle}>No archived events</Text>
            <Text style={styles.emptyText}>Events you archive will appear here.</Text>
          </View>
        )}

        {events.map(event => (
          <View key={event.id} style={styles.card}>
            {/* Banner / placeholder */}
            {event.bannerImageUrl ? (
              <Image source={{ uri: event.bannerImageUrl }} style={styles.banner} resizeMode="cover" />
            ) : event.image ? (
              <Image source={event.image} style={styles.banner} resizeMode="cover" />
            ) : (
              <View style={[styles.banner, styles.bannerPlaceholder]}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            )}

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{event.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{event.location}</Text>
                <Text style={styles.cardMeta}>{event.fullDate}</Text>
              </View>

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleUnarchive(event)}
                activeOpacity={0.8}>
                <Text style={styles.restoreBtnText}>Move to Events</Text>
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
