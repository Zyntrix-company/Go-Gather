/**
 * Custom gallery albums API — server-backed albums (sync + friend visibility).
 */
import client, { API_BASE } from './client';
import storage from '../utils/storage';
import useAuthStore from '../store/authStore';

export type GalleryAlbumCard = {
  id: string;
  name: string;
  bannerImageUrl?: string | null;
  gallerySubtitle?: string | null;
  photoCount?: number;
  section?: 'trip' | 'event';
  isCustom?: boolean;
};

export type GalleryAlbumsBySection = {
  trip: GalleryAlbumCard[];
  event: GalleryAlbumCard[];
};

export type GalleryPhoto = {
  id: string;
  url?: string;
  fileUrl?: string;
  uri?: string;
  activityId?: string | null;
  activityTitle?: string | null;
  createdAt?: string | null;
};

function uploadMultipart(path: string, formData: FormData): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let token = await storage.getToken();
    if (!token) token = useAuthStore.getState().accessToken;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 60000;
    xhr.onload = () => {
      let json: any;
      try { json = JSON.parse(xhr.responseText); } catch { json = { message: xhr.responseText }; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        reject(Object.assign(new Error(json?.message ?? 'Upload failed'), { response: { status: xhr.status, data: json } }));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(formData);
  });
}

export async function createGalleryAlbum(payload: {
  name: string;
  section: 'trip' | 'event';
  subtitle?: string;
}): Promise<GalleryAlbumCard> {
  const { data } = await client.post('/users/me/gallery/albums', payload);
  return data.album;
}

export async function updateGalleryAlbum(
  albumId: string,
  payload: { name?: string; subtitle?: string | null; bannerImageUrl?: string | null },
): Promise<GalleryAlbumCard> {
  const { data } = await client.patch(`/users/me/gallery/albums/${albumId}`, payload);
  return data.album;
}

export async function archiveGalleryAlbum(albumId: string) {
  const { data } = await client.post(`/users/me/gallery/albums/${albumId}/archive`);
  return data;
}

export async function unarchiveGalleryAlbum(albumId: string) {
  const { data } = await client.post(`/users/me/gallery/albums/${albumId}/unarchive`);
  return data;
}

export async function deleteGalleryAlbum(albumId: string) {
  const { data } = await client.delete(`/users/me/gallery/albums/${albumId}`);
  return data;
}

export async function getMyGalleryAlbumPhotos(albumId: string): Promise<{ photos: GalleryPhoto[]; total: number }> {
  const { data } = await client.get(`/users/me/gallery/albums/${albumId}/photos`);
  const photos = (data.photos ?? []).map((ph: any) => ({
    id: ph.id,
    uri: ph.url ?? ph.fileUrl ?? '',
    fileUrl: ph.fileUrl,
    url: ph.url,
  }));
  return { photos, total: data.total ?? photos.length };
}

export async function getUserGalleryAlbumPhotos(
  userId: string,
  albumId: string,
): Promise<{ photos: GalleryPhoto[]; total: number }> {
  const { data } = await client.get(`/users/${userId}/gallery/albums/${albumId}/photos`);
  const photos = (data.photos ?? []).map((ph: any) => ({
    id: ph.id,
    uri: ph.url ?? ph.fileUrl ?? '',
    fileUrl: ph.fileUrl,
    url: ph.url,
  }));
  return { photos, total: data.total ?? photos.length };
}

export async function uploadGalleryAlbumPhotos(
  albumId: string,
  assets: Array<{ uri: string; type?: string; name?: string }>,
): Promise<{ photos: GalleryPhoto[] }> {
  const formData = new FormData();
  assets.forEach((asset) => {
    formData.append('photos', {
      uri: asset.uri,
      type: asset.type ?? 'image/jpeg',
      name: asset.name ?? 'photo.jpg',
    } as any);
  });
  const data = await uploadMultipart(`/users/me/gallery/albums/${albumId}/photos`, formData);
  const photos = (data.photos ?? []).map((ph: any) => ({
    id: ph.id,
    uri: ph.url ?? ph.fileUrl ?? '',
    fileUrl: ph.fileUrl,
    url: ph.url,
  }));
  return { photos };
}

export async function deleteGalleryAlbumPhoto(albumId: string, photoId: string) {
  await client.delete(`/users/me/gallery/albums/${albumId}/photos/${photoId}`);
}

function mapGalleryItemPhoto(ph: any): GalleryPhoto {
  return {
    id: ph.id,
    uri: ph.url ?? ph.fileUrl ?? '',
    fileUrl: ph.fileUrl,
    url: ph.url,
    activityId: ph.activityId ?? null,
    activityTitle: ph.activityTitle ?? null,
  };
}

export async function getMyGalleryItemPhotos(
  parentType: 'trip' | 'event',
  parentId: string,
): Promise<{ photos: GalleryPhoto[]; total: number }> {
  const { data } = await client.get(`/users/me/gallery-items/${parentType}/${parentId}/photos`);
  const photos = (data.photos ?? []).map(mapGalleryItemPhoto);
  return { photos, total: data.total ?? photos.length };
}

export async function getUserGalleryItemPhotos(
  userId: string,
  parentType: 'trip' | 'event',
  parentId: string,
): Promise<{ photos: GalleryPhoto[]; total: number }> {
  const { data } = await client.get(`/users/${userId}/gallery-items/${parentType}/${parentId}/photos`);
  const photos = (data.photos ?? []).map(mapGalleryItemPhoto);
  return { photos, total: data.total ?? photos.length };
}

export function emptyCustomAlbums(): GalleryAlbumsBySection {
  return { trip: [], event: [] };
}

export type GalleryComment = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type GalleryEngagement = {
  likeCount: number;
  likedByMe: boolean;
  comments: GalleryComment[];
};

export async function getGalleryEngagement(
  parentType: 'trip' | 'event',
  parentId: string,
  galleryOwnerId?: string,
): Promise<GalleryEngagement> {
  const params = galleryOwnerId ? { galleryOwnerId } : undefined;
  const { data } = await client.get(
    `/users/me/gallery-items/${parentType}/${parentId}/engagement`,
    { params },
  );
  return data as GalleryEngagement;
}

export async function toggleGalleryLike(
  parentType: 'trip' | 'event',
  parentId: string,
  galleryOwnerId?: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const params = galleryOwnerId ? { galleryOwnerId } : undefined;
  const { data } = await client.post(
    `/users/me/gallery-items/${parentType}/${parentId}/like`,
    undefined,
    { params },
  );
  return data;
}

export async function addGalleryComment(
  parentType: 'trip' | 'event',
  parentId: string,
  text: string,
  galleryOwnerId?: string,
): Promise<GalleryComment> {
  const params = galleryOwnerId ? { galleryOwnerId } : undefined;
  const { data } = await client.post(
    `/users/me/gallery-items/${parentType}/${parentId}/comments`,
    { text },
    { params },
  );
  return data.comment;
}

export async function updateGalleryComment(commentId: string, text: string): Promise<GalleryComment> {
  const { data } = await client.patch(`/users/me/gallery-items/comments/${commentId}`, { text });
  return data.comment;
}

export async function deleteGalleryComment(commentId: string): Promise<void> {
  await client.delete(`/users/me/gallery-items/comments/${commentId}`);
}

export async function getCustomAlbumEngagement(albumId: string): Promise<GalleryEngagement> {
  const { data } = await client.get(`/users/me/gallery/albums/${albumId}/engagement`);
  return data as GalleryEngagement;
}

export async function toggleCustomAlbumLike(
  albumId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await client.post(`/users/me/gallery/albums/${albumId}/like`);
  return data;
}

export async function addCustomAlbumComment(albumId: string, text: string): Promise<GalleryComment> {
  const { data } = await client.post(`/users/me/gallery/albums/${albumId}/comments`, { text });
  return data.comment;
}
