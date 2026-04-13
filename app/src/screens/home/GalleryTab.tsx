import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

const PlusIcon = ({ color = '#fff', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const EditIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function GalleryTab({ user, trips, onEditProfile, onNavigateToTrip, onSetActiveTab }: any) {
  const [avatarError, setAvatarError] = useState(false);

  const displayName = user?.fullName || '';
  const handle = displayName.toLowerCase().replace(/ /g, '_') || 'username';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.galleryProfile}>
        <View style={styles.galleryAvatarWrap}>
          {user?.photoUrl && !avatarError ? (
            <Image source={{ uri: user.photoUrl }} style={styles.galleryAvatar} onError={() => setAvatarError(true)} />
          ) : (
            <View style={[styles.galleryAvatar, styles.galleryAvatarPlaceholder]}>
              <Text style={styles.galleryAvatarInitial}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.galleryEditBtn} onPress={onEditProfile} activeOpacity={0.8}>
            <EditIcon />
          </TouchableOpacity>
        </View>
        {displayName ? <Text style={styles.galleryName}>{displayName}</Text> : null}
        {displayName ? <Text style={styles.galleryHandle}>@{handle}</Text> : null}
        {user?.country ? (
          <View style={styles.galleryLocationRow}>
            <PinIcon color="#0d9488" size={14} />
            <Text style={styles.galleryLocationText}>{user.country}</Text>
          </View>
        ) : null}
        {user?.bio ? <Text style={styles.galleryBio}>{user.bio}</Text> : null}
      </View>

      <View style={styles.gallerySectionHeader}>
        <Text style={styles.gallerySectionTitle}>Gallery of Trips</Text>
        <TouchableOpacity onPress={() => onSetActiveTab('trips')}>
          <PlusIcon color="#0d9488" size={18} />
        </TouchableOpacity>
      </View>
      <View style={styles.galleryGrid}>
        {trips.map((trip: any) => (
          <TouchableOpacity key={trip.id} style={styles.galleryGridCard} onPress={() => onNavigateToTrip(trip)} activeOpacity={0.85}>
            <Image source={trip.image} style={styles.galleryGridImage} resizeMode="cover" />
            <View style={styles.galleryGridOverlay}>
              <Text style={styles.galleryGridText} numberOfLines={1}>{trip.name}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {trips.length === 0 && (
          <View style={styles.galleryEmptyCard}>
            <PlusIcon color="#cbd5e1" size={28} />
            <Text style={styles.galleryEmptyText}>Add Trip</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },
  galleryProfile: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  galleryAvatarWrap: { position: 'relative', marginBottom: 12 },
  galleryAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#0d9488' },
  galleryAvatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  galleryAvatarInitial: { fontSize: 36, fontWeight: '700', color: '#0d9488' },
  galleryEditBtn: { position: 'absolute', bottom: 2, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  galleryName: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  galleryHandle: { fontSize: 13, color: '#0d9488', fontWeight: '500', marginTop: 2 },
  galleryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  galleryLocationText: { fontSize: 13, color: '#64748b' },
  galleryBio: { fontSize: 14, color: '#334155', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
  gallerySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gallerySectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryGridCard: { width: (SCREEN_W - 52) / 2, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  galleryGridImage: { width: '100%', height: '100%' },
  galleryGridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8 },
  galleryGridText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  galleryEmptyCard: { width: (SCREEN_W - 52) / 2, height: 140, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  galleryEmptyText: { fontSize: 12, color: '#cbd5e1', fontWeight: '500' },
});

export default GalleryTab;
