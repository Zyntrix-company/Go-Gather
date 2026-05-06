import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Dimensions, StyleSheet, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Plane, CalendarDays, PencilLine } from 'lucide-react-native';
import { getUserGallery } from '../../api/ai.api';
import { getTripPhotos } from '../../api/trips.api';
import { getEventPhotos } from '../../api/events.api';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 52) / 2;

// ─── Icons ─────────────────────────────────────────────────────────────────

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

const CameraIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={4} stroke="#cbd5e1" strokeWidth={1.5} />
  </Svg>
);

const CloseIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const XIcon = ({ color = '#fff', size = 13 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, count, onAdd, icon }: { title: string; count: number; onAdd?: () => void; icon?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon && <View style={styles.sectionIcon}>{icon}</View>}
        <Text style={styles.sectionTitle}>{title}</Text>
        {count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      {onAdd && (
        <TouchableOpacity onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Gallery grid card (read-only, for API-driven trips/events) ──────────────

function GridCard({ item, onPress }: { item: any; onPress: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.bannerImageUrl && !imgError;

  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
      {hasImage ? (
        <CachedImage
          uri={item.bannerImageUrl}
          style={styles.gridCardImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.gridCardPlaceholder}>
          <CameraIcon />
        </View>
      )}
      <View style={styles.gridCardOverlay}>
        <Text style={styles.gridCardText} numberOfLines={1}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty card ─────────────────────────────────────────────────────────────

function EmptyCard({ label }: { label: string }) {
  return (
    <View style={styles.emptyCard}>
      <CameraIcon />
      <Text style={styles.emptyCardText}>{label}</Text>
    </View>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type PhotoItem = {
  id: string;
  uri: string;
  activityId?: string | null;
  activityTitle?: string | null;
};

type CustomCard = {
  id: string;
  name: string;
  bannerImageUrl?: string;
  type: 'trip' | 'event';
  photos: PhotoItem[];
};

function customCardsStorageKey(userId: string) {
  return `gogather_gallery_custom_cards_${userId}`;
}

// ─── Photo thumbnail with loading state ──────────────────────────────────────

function PhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      {!failed ? (
        <>
          <CachedImage
            uri={photo.uri}
            style={styles.thumbImg}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
          />
          {loading && (
            <View style={styles.thumbLoader}>
              <ActivityIndicator size="small" color="#0d9488" />
            </View>
          )}
        </>
      ) : (
        <View style={styles.thumbError}>
          <CameraIcon />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Full-screen preview ─────────────────────────────────────────────────────

function PreviewModal({ photo, onClose }: { photo: PhotoItem | null; onClose: () => void }) {
  const [previewLoading, setPreviewLoading] = useState(true);
  useEffect(() => { if (photo) setPreviewLoading(true); }, [photo?.uri]);
  return (
    <View style={styles.previewBg}>
      <TouchableOpacity onPress={onClose} style={styles.previewClose} activeOpacity={0.8}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      {photo && (
        <>
          <CachedImage
            uri={photo.uri}
            style={styles.previewImg}
            resizeMode="contain"
            onLoad={() => setPreviewLoading(false)}
            onError={() => setPreviewLoading(false)}
          />
          {previewLoading && (
            <ActivityIndicator style={styles.previewLoader} size="large" color="#fff" />
          )}
        </>
      )}
    </View>
  );
}

// ─── Photos modal (for API-driven trip/event cards) ───────────────────────────

function PhotosModal({
  visible,
  title,
  onClose,
  parentId,
  parentType,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  parentId: string;
  parentType: 'trip' | 'event';
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    const fetcher = parentType === 'trip'
      ? getTripPhotos(parentId)
      : getEventPhotos(parentId);
    fetcher
      .then((data) => {
        if (cancelled) return;
        const mapped: PhotoItem[] = (data.photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        }));
        setPhotos(mapped);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, parentId, parentType]);

  const activityGroups: Record<string, PhotoItem[]> = {};
  const directPhotos: PhotoItem[] = [];
  photos.forEach((ph) => {
    if (ph.activityId && ph.activityTitle) {
      if (!activityGroups[ph.activityTitle]) activityGroups[ph.activityTitle] = [];
      activityGroups[ph.activityTitle].push(ph);
    } else {
      directPhotos.push(ph);
    }
  });

  const renderThumb = (ph: PhotoItem) => (
    <PhotoThumb key={ph.id} photo={ph} onPress={() => setPreviewPhoto(ph)} />
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <CloseIcon />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogBody}>
                {loading && (
                  <View style={styles.modalLoadingRow}>
                    <ActivityIndicator color="#0d9488" />
                  </View>
                )}
                {!loading && photos.length === 0 && (
                  <View style={styles.emptyCenter}>
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                      <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No photos yet</Text>
                    <Text style={styles.emptySub}>No memories captured for this {parentType}.</Text>
                  </View>
                )}
                {!loading && photos.length > 0 && (
                  <View>
                    {Object.entries(activityGroups).map(([actTitle, actPhotos]) => (
                      <View key={actTitle} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{actTitle}</Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8' }}>({actPhotos.length})</Text>
                        </View>
                        <View style={styles.thumbRow}>
                          {actPhotos.map(renderThumb)}
                        </View>
                      </View>
                    ))}
                    {directPhotos.length > 0 && (
                      <View style={{ marginBottom: 8 }}>
                        {Object.keys(activityGroups).length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                            <View style={{ width: 3, height: 14, backgroundColor: '#64748b', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                              {parentType === 'trip' ? 'Trip Photos' : 'Event Photos'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>({directPhotos.length})</Text>
                          </View>
                        )}
                        <View style={styles.thumbRow}>
                          {directPhotos.map(renderThumb)}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <PreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
      </Modal>
    </>
  );
}

// ─── Create card modal (name + banner image picker) ──────────────────────────

function CreateCardModal({
  visible,
  type,
  onClose,
  onCreate,
}: {
  visible: boolean;
  type: 'trip' | 'event';
  onClose: () => void;
  onCreate: (name: string, bannerUri?: string) => void;
}) {
  const [name, setName] = useState('');
  const [bannerUri, setBannerUri] = useState<string | undefined>();
  const [bannerImgError, setBannerImgError] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setBannerUri(undefined);
      setBannerImgError(false);
    }
  }, [visible]);

  const pickBanner = () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, quality: 0.9, maxWidth: 1200, maxHeight: 800 },
      (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const uri = res.assets[0].uri;
        if (uri) { setBannerUri(uri); setBannerImgError(false); }
      },
    );
  };

  const submit = () => {
    const t = name.trim();
    if (!t) return;
    onCreate(t, bannerUri);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>
              New {type === 'trip' ? 'trip' : 'event'} album
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CloseIcon />
            </TouchableOpacity>
          </View>
          <View style={styles.dialogBody}>
            {/* Banner image picker */}
            <TouchableOpacity onPress={pickBanner} style={styles.bannerPicker} activeOpacity={0.8}>
              {bannerUri && !bannerImgError ? (
                <Image
                  source={{ uri: bannerUri }}
                  style={styles.bannerPreview}
                  resizeMode="cover"
                  onError={() => setBannerImgError(true)}
                />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={13} r={4} stroke="#cbd5e1" strokeWidth={1.5} />
                  </Svg>
                  <Text style={styles.bannerPickerLabel}>Add cover photo</Text>
                </View>
              )}
              {bannerUri && !bannerImgError && (
                <View style={styles.bannerEditBadge}>
                  <PencilLine size={13} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={type === 'trip' ? 'Trip name' : 'Event name'}
              placeholderTextColor="#94a3b8"
              style={styles.createAlbumInput}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={[styles.createAlbumBtn, !name.trim() && styles.createAlbumBtnDisabled]}
              onPress={submit}
              disabled={!name.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.createAlbumBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Custom card photos modal (view mode + edit mode toggled by pencil) ──────

function CustomCardPhotosModal({
  visible,
  card,
  onClose,
  onUpdateCard,
}: {
  visible: boolean;
  card: CustomCard | null;
  onClose: () => void;
  onUpdateCard: (next: CustomCard) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  // Reset to view mode whenever the modal opens/closes or card changes
  useEffect(() => {
    if (!visible) setEditMode(false);
  }, [visible]);

  const addPhotos = () => {
    if (!card) return;
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 20,
        includeBase64: false,
        quality: 0.85,
        maxWidth: 2048,
        maxHeight: 2048,
      },
      (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const ts = Date.now();
        const newPhotos: PhotoItem[] = res.assets
          .map((a, i) => ({ id: `local_${ts}_${i}`, uri: a.uri ?? '' }))
          .filter((p) => p.uri);
        if (!newPhotos.length) return;
        onUpdateCard({ ...card, photos: [...card.photos, ...newPhotos] });
      },
    );
  };

  const deletePhoto = (photoId: string) => {
    if (!card) return;
    onUpdateCard({ ...card, photos: card.photos.filter((p) => p.id !== photoId) });
  };

  if (!card) return null;
  const photos = card.photos;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            {/* Header: title + pencil (view) or Done (edit) + close */}
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle} numberOfLines={1}>{card.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {editMode ? (
                  <TouchableOpacity
                    onPress={() => setEditMode(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <CheckIcon />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setEditMode(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <PencilLine size={18} color="#0d9488" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogBody}>
                {photos.length === 0 && (
                  <View style={styles.emptyCenter}>
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                      <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No photos yet</Text>
                    <Text style={styles.emptySub}>
                      {editMode ? 'Tap "Add photos" below to fill this album.' : 'Tap the pencil icon to add photos.'}
                    </Text>
                  </View>
                )}

                {photos.length > 0 && (
                  <View style={styles.thumbRow}>
                    {photos.map((ph) => (
                      <View key={ph.id} style={{ position: 'relative' }}>
                        <PhotoThumb
                          photo={ph}
                          onPress={() => !editMode && setPreviewPhoto(ph)}
                        />
                        {/* Delete button only visible in edit mode */}
                        {editMode && (
                          <TouchableOpacity
                            onPress={() => deletePhoto(ph.id)}
                            style={styles.thumbDeleteBtn}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          >
                            <XIcon size={9} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Add photos button only in edit mode */}
                {editMode && (
                  <TouchableOpacity style={styles.addPhotosBtn} onPress={addPhotos} activeOpacity={0.85}>
                    <Text style={styles.addPhotosBtnText}>Add photos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full-screen preview only in view mode */}
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <PreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
      </Modal>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface GalleryTabProps {
  user: any;
  trips?: any[];
  onEditProfile: () => void;
  onNavigateToTrip: (trip: any) => void;
  onSetActiveTab: (tab: string) => void;
  onNavigateToEvent?: (event: any) => void;
}

export default function GalleryTab({
  user,
  trips: propTrips = [],
  onEditProfile,
}: GalleryTabProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [galleryTrips, setGalleryTrips] = useState<any[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Photo modal for API-driven trip/event cards
  const [photoModal, setPhotoModal] = useState<{ id: string; name: string; type: 'trip' | 'event' } | null>(null);

  // Custom cards (local, stored in AsyncStorage)
  const [customCards, setCustomCards] = useState<CustomCard[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [showCreateCard, setShowCreateCard] = useState<'trip' | 'event' | null>(null);
  const [openCard, setOpenCard] = useState<CustomCard | null>(null);

  const userId: string = user?.id ?? '';
  const displayName = user?.fullName ?? '';
  const handle = user?.username ?? displayName.toLowerCase().replace(/ /g, '_') ?? 'username';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoUrl]);

  // Load custom cards from device storage
  useEffect(() => {
    if (!userId) {
      setCustomCards([]);
      setCardsLoaded(false);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(customCardsStorageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          setCustomCards(Array.isArray(parsed) ? parsed : []);
        } catch {
          setCustomCards([]);
        }
      })
      .finally(() => { if (!cancelled) setCardsLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const saveCustomCards = (next: CustomCard[]) => {
    setCustomCards(next);
    if (userId) {
      AsyncStorage.setItem(customCardsStorageKey(userId), JSON.stringify(next)).catch(() => {});
    }
  };

  const createCustomCard = (name: string, bannerUri?: string) => {
    const card: CustomCard = {
      id: `cc_${Date.now()}`,
      name,
      bannerImageUrl: bannerUri,
      type: showCreateCard ?? 'trip',
      photos: [],
    };
    saveCustomCards([...customCards, card]);
  };

  const updateCustomCard = (next: CustomCard) => {
    const updated = customCards.map((c) => (c.id === next.id ? next : c));
    saveCustomCards(updated);
    setOpenCard((prev) => (prev?.id === next.id ? next : prev));
  };

  const deleteCustomCard = (id: string) => {
    saveCustomCards(customCards.filter((c) => c.id !== id));
  };

  // Fetch gallery data from server
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getUserGallery(userId)
      .then((data) => {
        if (cancelled) return;
        setGalleryTrips(data.trips ?? []);
        setGalleryEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setGalleryTrips(propTrips);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const displayTrips = galleryTrips.length > 0 ? galleryTrips : propTrips;

  const customTripCards = customCards.filter((c) => c.type === 'trip');
  const customEventCards = customCards.filter((c) => c.type === 'event');

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {user?.photoUrl && !avatarError ? (
                <Image
                  source={{ uri: user.photoUrl }}
                  style={styles.avatar}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              {displayName ? (
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{displayName}</Text>
                  <TouchableOpacity style={styles.editBtn} onPress={onEditProfile} activeOpacity={0.8}>
                    <PencilLine size={15} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ) : null}
              {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
              {user?.country ? (
                <View style={styles.locationRow}>
                  <PinIcon color="#0d9488" size={12} />
                  <Text style={styles.locationText}>{user.country}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        {/* ── Loading spinner ── */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#0d9488" />
          </View>
        )}

        {/* ── Gallery of Trips ── */}
        <SectionHeader
          title="Gallery of Trips"
          count={displayTrips.length + customTripCards.length}
          onAdd={() => setShowCreateCard('trip')}
          icon={<Plane size={20} color="#0d9488" />}
        />
        <View style={styles.grid}>
          {displayTrips.map((trip: any) => (
            <GridCard
              key={trip.id}
              item={trip}
              onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip' })}
            />
          ))}
          {cardsLoaded && customTripCards.map((card) => (
            <GridCard
              key={card.id}
              item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
              onPress={() => setOpenCard(card)}
            />
          ))}
          {displayTrips.length === 0 && customTripCards.length === 0 && !loading && (
            <EmptyCard label="Tap + to create a trip album" />
          )}
        </View>

        {/* ── Gallery of Events ── */}
        <View style={styles.sectionSpacer} />
        <SectionHeader
          title="Gallery of Events"
          count={galleryEvents.length + customEventCards.length}
          onAdd={() => setShowCreateCard('event')}
          icon={<CalendarDays size={20} color="#f59e0b" />}
        />
        <View style={styles.grid}>
          {galleryEvents.map((ev: any) => (
            <GridCard
              key={ev.id}
              item={ev}
              onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event' })}
            />
          ))}
          {cardsLoaded && customEventCards.map((card) => (
            <GridCard
              key={card.id}
              item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
              onPress={() => setOpenCard(card)}
            />
          ))}
          {galleryEvents.length === 0 && customEventCards.length === 0 && !loading && (
            <EmptyCard label="Tap + to create an event album" />
          )}
        </View>

      </ScrollView>

      {/* ── Modals (outside ScrollView) ── */}
      {photoModal && (
        <PhotosModal
          visible
          title={photoModal.name}
          parentId={photoModal.id}
          parentType={photoModal.type}
          onClose={() => setPhotoModal(null)}
        />
      )}

      <CreateCardModal
        visible={showCreateCard !== null}
        type={showCreateCard ?? 'trip'}
        onClose={() => setShowCreateCard(null)}
        onCreate={createCustomCard}
      />

      <CustomCardPhotosModal
        visible={!!openCard}
        card={openCard}
        onClose={() => setOpenCard(null)}
        onUpdateCard={updateCustomCard}
      />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  avatarWrap: { position: 'relative' },
  profileInfo: { justifyContent: 'center', gap: 4 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: '#0d9488' },
  avatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#0d9488' },
  editBtn: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '400', color: '#0F172B' },
  handle: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 14, color: '#45556C' },
  bio: { fontSize: 14, color: '#45556C', textAlign: 'center', marginTop: 12, lineHeight: 20 },

  loadingRow: { alignItems: 'center', marginBottom: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '400', color: '#0F172B' },
  countBadge: {
    backgroundColor: '#f0fdfa', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },

  sectionSpacer: { height: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  gridCard: { width: CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gridCardImage: { width: '100%', height: '100%' },
  gridCardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  gridCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  gridCardText: { color: '#fff', fontSize: 12, fontWeight: '400', lineHeight: 15 },

  emptyCard: {
    width: CARD_W, height: 140, borderRadius: 14,
    borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fafafa',
  },
  emptyCardText: { fontSize: 12, color: '#cbd5e1', fontWeight: '500' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  dialogHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  dialogBody: { padding: 16 },

  modalLoadingRow: { alignItems: 'center', paddingVertical: 32 },

  emptyCenter: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  thumbError: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },

  // Per-photo delete button inside CustomCardPhotosModal
  thumbDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220,38,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Full-screen preview
  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  previewClose: {
    position: 'absolute', top: 48, left: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewLoader: { position: 'absolute' },

  // Create card modal
  bannerPicker: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  bannerPreview: { width: '100%', height: '100%' },
  bannerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bannerPickerLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  bannerEditBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  createAlbumInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 14,
  },
  createAlbumBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createAlbumBtnDisabled: { opacity: 0.45 },
  createAlbumBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  addPhotosBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0d9488',
    alignItems: 'center',
  },
  addPhotosBtnText: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
});
