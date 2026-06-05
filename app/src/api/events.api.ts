/**
 * GatherGo Events API
 * Covers: Events CRUD, Members, Expenses, Docs, Photos, Notes, Polls, Invites, Archive
 */
import client, { API_BASE } from './client';
import storage from '../utils/storage';
import { parseError, handleApiError, ApiError, Doc, Photo, Expense, SplitUser, Debt, Note, Poll, TripMember } from './trips.api';
import useAuthStore from '../store/authStore';

// ─── Multipart upload helper ──────────────────────────────────────────────────
// Uses XMLHttpRequest — RN's XHR resolves content:// and file:// URIs in
// FormData on Android correctly, whereas fetch cannot read content:// URIs.
function uploadMultipart(path: string, formData: FormData): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let token = await storage.getToken();
    if (!token) {
      token = useAuthStore.getState().accessToken;
    }
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

export { parseError, handleApiError };
export type { ApiError };

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventLocation = { name: string | null; lat: number | null; lng: number | null };

export type Event = {
  id: string;
  name: string;
  eventDate: string;
  eventType: string | null;
  description: string | null;
  bannerImageUrl: string | null;
  bannerCropFraction?: { imgFracX: number; imgFracY: number; imgFracW: number; imgFracH: number } | null;
  location: EventLocation;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  memberAvatars?: string[];
};

export type EventMember = TripMember;

export type EventStats = {
  memberCount: number;
  photoVideoCount: number;
  docCount: number;
  totalExpenseAmount: number;
};

export type EventDetail = {
  event: Event;
  members: EventMember[];
  stats: EventStats;
};

// Re-export shared sub-resource types from trips.api so callers can import from one place
export type { Doc, Photo, Expense, SplitUser, Debt, Note, Poll };

// ─── 1. Events CRUD ───────────────────────────────────────────────────────────

export async function getEvents(params?: {
  status?: 'upcoming' | 'ongoing' | 'past';
  page?: number;
  limit?: number;
}) {
  const res = await client.get('/events', { params });
  return res.data as { events: Event[]; total: number; page: number; limit: number };
}

export async function getArchivedEvents() {
  const res = await client.get('/events', { params: { status: 'archived' } });
  return res.data as { events: Event[]; total: number };
}

export async function createEvent(body: {
  name: string;
  eventDate: string;
  eventType?: string;
  description?: string;
  bannerImageUrl?: string;
  bannerCropFraction?: { imgFracX: number; imgFracY: number; imgFracW: number; imgFracH: number } | null;
  location?: { name?: string; lat?: number; lng?: number };
  reminders?: boolean;
  friendIds?: string[];
  emails?: string[];
}) {
  const res = await client.post('/events', body);
  return res.data as { event: Event; memberCount: number };
}

export async function getEventDetail(eventId: string) {
  const res = await client.get(`/events/${eventId}`);
  return res.data as EventDetail & { stats?: any; unreadCounts?: Record<string, number> };
}

export async function markEventSectionViewed(eventId: string, section: string) {
  await client.post(`/events/${eventId}/sections/${section}/view`).catch(() => { /* non-critical */ });
}

export async function updateEvent(eventId: string, body: Partial<{
  name: string;
  eventDate: string;
  eventType: string;
  description: string;
  bannerImageUrl: string;
  bannerCropFraction: { imgFracX: number; imgFracY: number; imgFracW: number; imgFracH: number } | null;
  location: { name?: string; lat?: number; lng?: number };
}>) {
  const res = await client.put(`/events/${eventId}`, body);
  return res.data as { event: Event };
}

export async function deleteEvent(eventId: string) {
  const res = await client.delete(`/events/${eventId}`);
  return res.data as { success: boolean };
}

export async function archiveEvent(eventId: string) {
  const res = await client.post(`/events/${eventId}/archive`);
  return res.data as { success: boolean };
}

export async function unarchiveEvent(eventId: string) {
  const res = await client.post(`/events/${eventId}/unarchive`);
  return res.data as { success: boolean };
}

// ─── 2. Members ───────────────────────────────────────────────────────────────

export async function getEventMembers(eventId: string) {
  const res = await client.get(`/events/${eventId}/members`);
  return res.data as { members: EventMember[]; total: number; adminCount: number };
}

export async function removeEventMember(eventId: string, userId: string) {
  const res = await client.delete(`/events/${eventId}/members/${userId}`);
  return res.data as { success: boolean };
}

export async function inviteToEvent(eventId: string, body: {
  friendIds?: string[];
  emails?: string[];
  phones?: string[];
  shareOnly?: boolean;
}) {
  const res = await client.post(`/events/${eventId}/invite`, body);
  return res.data as {
    added: { userId: string; name: string; method: string }[];
    invited: { email?: string; phone?: string; branchUrl: string; expiresAt: string }[];
    skipped: { userId: string; reason: string }[];
    shareText?: string;
  };
}

// ─── 3. Docs ──────────────────────────────────────────────────────────────────

export async function getEventDocs(eventId: string) {
  const res = await client.get(`/events/${eventId}/docs`);
  return res.data as { docs: Doc[]; total: number };
}

export async function uploadEventDoc(eventId: string, asset: { uri: string; type?: string; name?: string }) {
  const formData = new FormData();
  formData.append('file', { uri: asset.uri, type: asset.type ?? 'application/octet-stream', name: asset.name ?? 'document' } as any);
  return uploadMultipart(`/events/${eventId}/docs`, formData) as Promise<{ doc: Doc }>;
}

export async function deleteEventDoc(eventId: string, docId: string) {
  const res = await client.delete(`/events/${eventId}/docs/${docId}`);
  return res.data as { success: boolean };
}

// ─── 4. Photos ────────────────────────────────────────────────────────────────

export async function getEventPhotos(eventId: string) {
  const res = await client.get(`/events/${eventId}/photos`);
  return res.data as { photos: Photo[]; total: number };
}

export async function uploadEventPhotos(eventId: string, assets: Array<{ uri: string; type?: string; name?: string }>) {
  const formData = new FormData();
  assets.forEach(asset => {
    formData.append('photos', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.name ?? 'photo.jpg' } as any);
  });
  return uploadMultipart(`/events/${eventId}/photos`, formData) as Promise<{ photos: Photo[] }>;
}

export async function deleteEventPhoto(eventId: string, photoId: string) {
  const res = await client.delete(`/events/${eventId}/photos/${photoId}`);
  return res.data as { success: boolean };
}

// ─── 5. Expenses ──────────────────────────────────────────────────────────────

export async function getEventExpenses(eventId: string) {
  const res = await client.get(`/events/${eventId}/expenses`);
  return res.data as { expenses: Expense[]; total: number; grandTotal: number };
}

export async function createEventExpense(eventId: string, body: {
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  paidBy?: string;
  splitType: 'equal' | 'amount' | 'percentage';
  splitAmong: SplitUser[];
}) {
  const res = await client.post(`/events/${eventId}/expenses`, body);
  return res.data as { expense: Expense; balances: Debt[] };
}

export async function updateEventExpense(eventId: string, eid: string, body: Partial<{
  description: string;
  amount: number;
  currency: string;
  category: string;
  splitType: 'equal' | 'amount' | 'percentage';
  splitAmong: SplitUser[];
}>) {
  const res = await client.put(`/events/${eventId}/expenses/${eid}`, body);
  return res.data as { expense: Expense; balances: Debt[] };
}

export async function deleteEventExpense(eventId: string, eid: string) {
  const res = await client.delete(`/events/${eventId}/expenses/${eid}`);
  return res.data as { success: boolean };
}

export async function getEventBalances(eventId: string) {
  const res = await client.get(`/events/${eventId}/balances`);
  return res.data as {
    debts: Debt[];
    myBalances: Record<string, number>;
    totalExpensesByCurrency: Record<string, string>;
    /** @deprecated legacy single-value field for backward compat */
    myBalance: number;
    /** @deprecated legacy single-value field for backward compat */
    totalExpenses: string;
  };
}

export async function settleEventDebt(eventId: string, body: { withUserId: string; amount: number; currency?: string }) {
  const res = await client.post(`/events/${eventId}/settlements`, body);
  return res.data as { outstanding: Debt[] };
}

// ─── 6. Notes ─────────────────────────────────────────────────────────────────

export async function getEventNotes(eventId: string) {
  const res = await client.get(`/events/${eventId}/notes`);
  return res.data as { notes: Note[]; total: number };
}

export async function createEventNote(eventId: string, body: {
  title: string;
  content: string;
  category?: 'general' | 'idea' | 'important' | 'todo';
}) {
  const res = await client.post(`/events/${eventId}/notes`, body);
  return res.data as { note: Note };
}

export async function updateEventNote(eventId: string, noteId: string, body: Partial<{
  title: string;
  content: string;
  category: 'general' | 'idea' | 'important' | 'todo';
  pinned: boolean;
}>) {
  const res = await client.put(`/events/${eventId}/notes/${noteId}`, body);
  return res.data as { note: Note };
}

export async function deleteEventNote(eventId: string, noteId: string) {
  const res = await client.delete(`/events/${eventId}/notes/${noteId}`);
  return res.data as { success: boolean };
}

// ─── 7. Polls ─────────────────────────────────────────────────────────────────

export async function getEventPolls(eventId: string) {
  const res = await client.get(`/events/${eventId}/polls`);
  return res.data as { polls: Poll[] };
}

export async function createEventPoll(eventId: string, body: { question: string; options: string[] }) {
  const res = await client.post(`/events/${eventId}/polls`, body);
  return res.data as { poll: Poll };
}

export async function voteOnEventPoll(eventId: string, pollId: string, optionId: string) {
  const res = await client.post(`/events/${eventId}/polls/${pollId}/vote`, { optionId });
  return res.data as { poll: Poll };
}

export async function deleteEventPoll(eventId: string, pollId: string) {
  await client.delete(`/events/${eventId}/polls/${pollId}`);
}
