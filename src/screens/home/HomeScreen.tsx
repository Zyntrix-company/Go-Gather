import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

// --- Icons ---

const BellIcon = () => (
  <View>
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>2</Text>
    </View>
  </View>
);

const MenuIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M3 12h18M3 6h18M3 18h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const StarIcon = ({ color = "#f59e0b", size = 16 }: { color?: string, size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} />
  </Svg>
);

const PinIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CalendarIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#94a3b8" strokeWidth={2} />
    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MoreIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={5} r={1} fill="#ffffff" />
    <Circle cx={12} cy={12} r={1} fill="#ffffff" />
    <Circle cx={12} cy={19} r={1} fill="#ffffff" />
  </Svg>
);

const FabIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const UserMenuIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PrivacyIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SettingsIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// --- Bottom Nav Icons ---

const NavIcon = ({ name, active }: { name: string, active?: boolean }) => {
  const color = active ? "#0d9488" : "#94a3b8";
  return (
    <View style={styles.navItem}>
      {name === 'trips' && (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'events' && (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} />
        </Svg>
      )}
      {name === 'feed' && (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
          <Path d="M12 16l4-4-4-4M8 12h8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'friends' && (
        <Svg width={22} height={21} viewBox="0 0 24 24" fill="none">
          <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'chat' && (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'gallery' && (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Circle cx={8.5} cy={8.5} r={1.5} fill={color} />
          <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Text style={[styles.navText, active && styles.navTextActive]}>
        {name.charAt(0).toUpperCase() + name.slice(1)}
      </Text>
    </View>
  );
};

export default function HomeScreen({ navigation }: any) {
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Mock avatars
  const avatars = [
    { id: 1, uri: 'https://i.pravatar.cc/150?u=1' },
    { id: 2, uri: 'https://i.pravatar.cc/150?u=2' },
    { id: 3, uri: 'https://i.pravatar.cc/150?u=3' },
  ];

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Logo size="small" />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <BellIcon />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowProfileMenu(!showProfileMenu)}
              style={[styles.headerIcon, showProfileMenu && styles.headerIconActive]}>
              <MenuIcon />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Dropdown Menu */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity
              style={styles.dropdownBackdrop}
              activeOpacity={1}
              onPress={() => setShowProfileMenu(false)}
            />
            <View style={styles.profileDropdown}>
              <View style={styles.dropdownHeader}>
                <Image
                  source={{ uri: user?.photoUrl || 'https://i.pravatar.cc/150?u=me' }}
                  style={styles.dropdownAvatar}
                />
                <View style={styles.dropdownUserText}>
                  <Text style={styles.dropdownName}>{user?.fullName || 'User Name'}</Text>
                  <Text style={styles.dropdownEmail} numberOfLines={1}>{user?.email || 'user@email.com'}</Text>
                </View>
              </View>

              <View style={styles.dropdownDivider} />

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('Profile');
                }}>
                <UserMenuIcon />
                <Text style={styles.dropdownItemText}>Account</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
                <PrivacyIcon />
                <Text style={styles.dropdownItemText}>Privacy</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
                <SettingsIcon />
                <Text style={styles.dropdownItemText}>Settings</Text>
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  logout();
                }}>
                <LogoutIcon />
                <Text style={[styles.dropdownItemText, styles.logoutLabel]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome, {user?.fullName?.split(' ')[0] || 'Explorer'}!</Text>
            <Text style={styles.welcomeSubtitle}>Gather your crew & make memories</Text>
          </View>

          {/* Create New Trip Button */}
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.9}>
            <Text style={styles.createBtnText}>Create New Trip</Text>
          </TouchableOpacity>

          {/* AI Assistance Box */}
          <View style={styles.aiBox}>
            <Text style={styles.aiText}>Need help planning your adventure?</Text>
            <TouchableOpacity style={styles.askBtn}>
              <StarIcon color="#0d9488" size={14} />
              <Text style={styles.askBtnText}>Ask Swee</Text>
            </TouchableOpacity>
          </View>

          {/* Upcoming Trips Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Trips</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardMedia}>
              <Image
                source={require('../../assets/images/goa_beach.png')}
                style={styles.cardImage as any}
              />
              <TouchableOpacity style={styles.cardMore}>
                <MoreIcon />
              </TouchableOpacity>
              <View style={styles.participantAvatars}>
                {avatars.map((av, idx) => (
                  <Image
                    key={av.id}
                    source={{ uri: av.uri }}
                    style={[styles.miniAvatar as any, { marginLeft: idx > 0 ? -10 : 0 }]}
                  />
                ))}
                <View style={styles.moreCounter}>
                  <Text style={styles.moreCounterText}>+1</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>Goa Birthday Trip</Text>
                <View style={styles.cardInfoRow}>
                  <View style={styles.infoItem}>
                    <PinIcon />
                    <Text style={styles.infoText}>Goa, India</Text>
                  </View>
                </View>
                <View style={styles.cardInfoRow}>
                  <View style={styles.infoItem}>
                    <CalendarIcon />
                    <Text style={styles.infoText}>15 May - 20 May</Text>
                  </View>
                </View>
              </View>
              <View style={styles.daysBadge}>
                <Text style={styles.daysNumber}>63</Text>
                <Text style={styles.daysLabel}>DAYS TO GO</Text>
              </View>
            </View>
          </View>

          {/* Upcoming Events Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardMedia}>
              <Image
                source={require('../../assets/images/music_festival.png')}
                style={styles.cardImage as any}
              />
              <TouchableOpacity style={styles.cardMore}>
                <MoreIcon />
              </TouchableOpacity>
              <View style={styles.participantAvatars}>
                {avatars.slice(0, 2).map((av, idx) => (
                  <Image
                    key={av.id}
                    source={{ uri: av.uri }}
                    style={[styles.miniAvatar as any, { marginLeft: idx > 0 ? -10 : 0 }]}
                  />
                ))}
                <View style={styles.moreCounter}>
                  <Text style={styles.moreCounterText}>+1</Text>
                </View>
              </View>
              {/* Floating Action Button inside Event */}
              <TouchableOpacity style={styles.fabEvent}>
                <FabIcon />
              </TouchableOpacity>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>Spring Music Festival</Text>
                <View style={styles.cardInfoRow}>
                  <View style={styles.infoItem}>
                    <PinIcon />
                    <Text style={styles.infoText}>Bangalore, Palace Grounds</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          <NavIcon name="trips" active />
          <NavIcon name="events" />

          <NavIcon name="friends" />
          <NavIcon name="chat" />
          <NavIcon name="gallery" />
        </View>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  headerIconActive: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdownBackdrop: {
    flex: 1,
  },
  profileDropdown: {
    position: 'absolute',
    top: 70,
    right: 20,
    width: 240,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  dropdownAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
  },
  dropdownUserText: {
    flex: 1,
  },
  dropdownName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  logoutLabel: {
    color: '#ef4444',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for tab bar
  },
  welcomeSection: {
    marginTop: 10,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#334155',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 5,
  },
  createBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 25,
    paddingVertical: 14,
    width: 180,
    alignSelf: 'center',
    marginTop: 25,
    alignItems: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  aiBox: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginTop: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  aiText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 10,
  },
  askBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    verticalAlign: 'middle',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  askBtnText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#334155',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardMedia: {
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardMore: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatars: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 4,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  moreCounter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  moreCounterText: {
    fontSize: 9,
    color: '#0d9488',
    fontWeight: 'bold',
  },
  cardBody: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  cardInfoRow: {
    marginVertical: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  daysBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0d9488',
  },
  daysLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: 'bold',
    marginTop: -2,
  },
  fabEvent: {
    position: 'absolute',
    bottom: -15,
    right: 15,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 75,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },
});
