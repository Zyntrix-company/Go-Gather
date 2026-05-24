import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createGalleryAlbum,
  uploadGalleryAlbumPhotos,
  updateGalleryAlbum,
  archiveGalleryAlbum,
} from '../api/gallery.api';

const MIGRATED_KEY = 'gogather_gallery_custom_migrated_v1';

export function customCardsStorageKey(userId: string) {
  return `gogather_gallery_custom_cards_${userId}`;
}

type LegacyCard = {
  id: string;
  name: string;
  bannerImageUrl?: string;
  type: 'trip' | 'event';
  photos?: Array<{ id: string; uri: string; localUri?: string }>;
  archived?: boolean;
  archivedAt?: string;
};

export async function migrateLocalCustomGalleryAlbums(userId: string): Promise<void> {
  const done = await AsyncStorage.getItem(MIGRATED_KEY);
  if (done === 'true') return;

  const raw = await AsyncStorage.getItem(customCardsStorageKey(userId));
  if (!raw) {
    await AsyncStorage.setItem(MIGRATED_KEY, 'true');
    return;
  }

  let cards: LegacyCard[] = [];
  try {
    const parsed = JSON.parse(raw);
    cards = Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.setItem(MIGRATED_KEY, 'true');
    return;
  }

  for (const card of cards) {
    try {
      const album = await createGalleryAlbum({
        name: card.name || 'Album',
        section: card.type === 'event' ? 'event' : 'trip',
      });

      const uploadable = (card.photos ?? [])
        .map((p) => ({ uri: p.localUri || p.uri, type: 'image/jpeg', name: 'photo.jpg' }))
        .filter((a) => a.uri && (a.uri.startsWith('file://') || a.uri.startsWith('content://')));

      if (uploadable.length > 0) {
        try {
          const { photos } = await uploadGalleryAlbumPhotos(album.id, uploadable);
          const cover = card.bannerImageUrl || photos[0]?.uri;
          if (cover && !cover.startsWith('file://') && !cover.startsWith('content://')) {
            await updateGalleryAlbum(album.id, { bannerImageUrl: cover });
          } else if (photos[0]?.uri) {
            await updateGalleryAlbum(album.id, { bannerImageUrl: photos[0].uri });
          }
        } catch {
          /* local files may be gone */
        }
      } else if (
        card.bannerImageUrl
        && !card.bannerImageUrl.startsWith('file://')
        && !card.bannerImageUrl.startsWith('content://')
      ) {
        await updateGalleryAlbum(album.id, { bannerImageUrl: card.bannerImageUrl });
      }

      if (card.archived) {
        await archiveGalleryAlbum(album.id);
      }
    } catch {
      /* continue with next card */
    }
  }

  await AsyncStorage.setItem(MIGRATED_KEY, 'true');
  await AsyncStorage.removeItem(customCardsStorageKey(userId));
}
