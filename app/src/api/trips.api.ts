/**
 * GatherGo Trips API — M2 + M4
 * Covers: Trips CRUD, Members, Activities, Expenses, Docs, Photos, Notes, Polls, Invites
 */
import client, { API_BASE } from './client';
import storage from '../utils/storage';
import Toast from 'react-native-toast-message';

// ─── Multipart upload helper (bypasses axios so RN networking sets the boundary) ──
async function uploadMultipart(path: string, formData: FormData): Promise<any> {
  let token = await storage.getToken();
  if (!token) {
    const { default: useAuthStore } = await import('../store/authStore');
    token = useAuthStore.getState().accessToken;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60 s for file uploads
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { message: text }; }
    if (!res.ok) throw Object.assign(new Error(json?.message ?? 'Upload failed'), { response: { status: res.status, data: json } });
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Shared error parser ───────────────────────────────────────────────────────

export type ApiError = {
  error: string;
  message: string;
  statusCode: number;
  errors?: { field: string; message: string }[];
  retryAfter?: number;
};

export function parseError(err: any): ApiError {
  const data = err?.response?.data;
  return {
    error: data?.error ?? 'UNKNOWN_ERROR',
    message: data?.message ?? err?.message ?? 'Something went wrong',
    statusCode: err?.response?.status ?? 0,
    errors: data?.errors,
    retryAfter: data?.retryAfter,
  };
}

/** Shows a toast for common error codes; returns the parsed error for the caller to inspect. */
export function handleApiError(err: any): ApiError {
  const parsed = parseError(err);
  switch (parsed.error) {
    case 'ADMIN_REQUIRED':
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Admin access required.' });
      break;
    case 'NOT_FOUND':
      Toast.show({ type: 'error', text1: 'Not Found', text2: parsed.message });
      break;
    case 'RATE_LIMIT_EXCEEDED':
      Toast.show({
        type: 'error',
        text1: 'Too Many Requests',
        text2: parsed.retryAfter
          ? `Try again in ${parsed.retryAfter}s`
          : 'Try again later.',
      });
      break;
    case 'VALIDATION_ERROR':
      // Field-level errors surfaced by the caller via parsed.errors[]
      Toast.show({ type: 'error', text1: 'Validation Error', text2: parsed.message });
      break;
    default:
      Toast.show({ type: 'error', text1: 'Error', text2: parsed.message });
  }
  return parsed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripLocation = { name: string; lat?: number; lng?: number };

export type Trip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: TripLocation | string;
  coverPhotoUrl: string | null;
  bannerImageUrl?: string | null;
  createdBy: string;
  daysToGo?: number;
  memberCount?: number;
  photoVideoCount?: number;
  docCount?: number;
  totalExpenseAmount?: string;
};

export type TripMember = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
};

export type Activity = {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  date?: string;
  time?: string | { hour: number; minute: number };
  location?: string;
  cost?: string;
  createdBy: string;
  createdAt: string;
  photoCount?: number;
  completed?: boolean;
  linkedExpense?: { id: string; description: string; amount: number } | null;
};

export type Photo = {
  id: string;
  fileUrl?: string;
  url?: string;
  mimeType?: string;
  uploadedBy: string;
  uploadedAt: string;
  activityId?: string | null;
  activityTitle?: string | null;
};

export type Doc = {
  id: string;
  fileName: string;
  fileUrl?: string;
  downloadUrl?: string;   // presigned S3 URL (1hr) — preferred for viewing
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type SplitUser =
  | { userId: string }
  | { userId: string; amount: number }
  | { userId: string; percentage: number };

export type Expense = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  category?: string;
  splitType: 'equal' | 'amount' | 'percentage';
  paidBy: string;
  parentType: string;
  parentId: string;
  createdAt: string;
  splits: { userId: string; amount: string; percentage: string | null }[];
};

export type Debt = {
  from: string;
  to: string;
  amount: number;
  fromName: string;
  toName: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  category?: 'general' | 'idea' | 'important' | 'todo';
  pinned?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PollOption = {
  id: string;
  text: string;
  voteCount: number;
  votedByMe: boolean;
};

export type Poll = {
  id: string;
  question: string;
  createdBy: string;
  createdAt: string;
  options: PollOption[];
  totalVotes: number;
  myVoteOptionId: string | null;
};

// ─── 1. Trips Core CRUD ───────────────────────────────────────────────────────

export async function getTrips(params?: { status?: 'upcoming' | 'ongoing' | 'past'; page?: number; limit?: number }) {
  const res = await client.get('/trips', { params });
  return res.data as { trips: Trip[]; total: number; page: number; limit: number };
}

export async function createTrip(body: {
  name: string;
  startDate: string;
  endDate: string;
  location: TripLocation;
  bannerImageUrl?: string;
  reminders?: boolean;
  friendIds?: string[];
  emails?: string[];
}) {
  const res = await client.post('/trips', body);
  return res.data as { trip: Trip };
}

export async function getTripDetail(tripId: string) {
  const res = await client.get(`/trips/${tripId}`);
  return res.data as { trip: Trip; role: 'admin' | 'member' };
}

export async function updateTrip(tripId: string, body: Partial<{ name: string; startDate: string; endDate: string; location: TripLocation; bannerImageUrl: string }>) {
  const res = await client.put(`/trips/${tripId}`, body);
  return res.data as { trip: Trip };
}

export async function deleteTrip(tripId: string) {
  const res = await client.delete(`/trips/${tripId}`);
  return res.data as { success: boolean };
}

export async function archiveTrip(tripId: string) {
  const res = await client.post(`/trips/${tripId}/archive`);
  return res.data as { success: boolean };
}

export async function unarchiveTrip(tripId: string) {
  const res = await client.post(`/trips/${tripId}/unarchive`);
  return res.data as { success: boolean };
}

export async function getArchivedTrips() {
  const res = await client.get('/trips?status=archived');
  return res.data as { trips: Trip[] };
}

// ─── 2. Trip Members ──────────────────────────────────────────────────────────

export async function getTripMembers(tripId: string) {
  const res = await client.get(`/trips/${tripId}/members`);
  return res.data as { members: TripMember[] };
}

export async function removeTripMember(tripId: string, userId: string) {
  const res = await client.delete(`/trips/${tripId}/members/${userId}`);
  return res.data as { success: boolean };
}

export async function inviteToTrip(tripId: string, body: { friendIds?: string[]; emails?: string[] }) {
  const res = await client.post(`/trips/${tripId}/invite`, body);
  return res.data as {
    added: string[];
    invited: { email: string; token: string; branchUrl: string; expiresAt: string }[];
  };
}

// ─── 3. Trip Activities ───────────────────────────────────────────────────────

export async function getActivities(tripId: string) {
  const res = await client.get(`/trips/${tripId}/activities`);
  return res.data as { activities?: Activity[]; upcoming?: Activity[]; completed?: Activity[] };
}

export async function createActivity(tripId: string, body: {
  title: string;
  description?: string;
  date?: string;
  time?: string | { hour: number; minute: number };
  location?: string;
  locationName?: string;
  cost?: number;
  expenseId?: string | null;
}) {
  const res = await client.post(`/trips/${tripId}/activities`, body);
  return res.data as { activity: Activity };
}

export async function updateActivity(tripId: string, actId: string, body: Partial<{
  title: string;
  description: string;
  date: string;
  time: string | { hour: number; minute: number };
  location: string;
  locationName: string;
  cost: number;
  isCompleted: boolean;
}>) {
  const res = await client.put(`/trips/${tripId}/activities/${actId}`, body);
  return res.data as { activity: Activity };
}

export async function deleteActivity(tripId: string, actId: string) {
  const res = await client.delete(`/trips/${tripId}/activities/${actId}`);
  return res.data as { success: boolean };
}

export async function uploadActivityPhotos(tripId: string, actId: string, assets: Array<{ uri: string; type?: string; name?: string }>) {
  const formData = new FormData();
  assets.forEach(asset => {
    formData.append('photos', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.name ?? 'photo.jpg' } as any);
  });
  return uploadMultipart(`/trips/${tripId}/activities/${actId}/photos`, formData) as Promise<{ photos: Photo[] }>;
}

export async function getActivityPhotos(tripId: string, actId: string) {
  const res = await client.get(`/trips/${tripId}/activities/${actId}/photos`);
  return res.data as { photos: Photo[] };
}

export async function deleteActivityPhoto(tripId: string, actId: string, photoId: string) {
  const res = await client.delete(`/trips/${tripId}/activities/${actId}/photos/${photoId}`);
  return res.data as { success: boolean };
}

// ─── 4. Expenses ──────────────────────────────────────────────────────────────

export async function getExpenses(tripId: string, params?: { category?: string; page?: number; limit?: number }) {
  const res = await client.get(`/trips/${tripId}/expenses`, { params });
  return res.data as { expenses: Expense[]; total: number; page: number; limit: number };
}

export async function createExpense(tripId: string, body: {
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  paidBy?: string;
  splitType: 'equal' | 'amount' | 'percentage';
  splitAmong: SplitUser[];
}) {
  const res = await client.post(`/trips/${tripId}/expenses`, body);
  return res.data as { expense: Expense; balances: Debt[] };
}

export async function updateExpense(tripId: string, eid: string, body: Partial<{
  description: string;
  amount: number;
  currency: string;
  category: string;
  splitType: 'equal' | 'amount' | 'percentage';
  splitAmong: SplitUser[];
}>) {
  const res = await client.put(`/trips/${tripId}/expenses/${eid}`, body);
  return res.data as { expense: Expense; balances: Debt[] };
}

export async function deleteExpense(tripId: string, eid: string) {
  const res = await client.delete(`/trips/${tripId}/expenses/${eid}`);
  return res.data as { success: boolean; balances: Debt[] };
}

export async function getBalances(tripId: string) {
  const res = await client.get(`/trips/${tripId}/balances`);
  return res.data as { debts: Debt[]; myBalance: number; totalExpenses: string };
}

export async function settleDebt(tripId: string, body: { withUserId: string; amount: number }) {
  const res = await client.post(`/trips/${tripId}/settlements`, body);
  return res.data as { outstanding: Debt[] };
}

// ─── 5. Documents ─────────────────────────────────────────────────────────────

export async function getDocs(tripId: string) {
  const res = await client.get(`/trips/${tripId}/docs`);
  return res.data as { docs: Doc[]; total: number };
}

export async function uploadDoc(tripId: string, asset: { uri: string; type?: string; name?: string }) {
  const formData = new FormData();
  formData.append('file', { uri: asset.uri, type: asset.type ?? 'application/octet-stream', name: asset.name ?? 'document' } as any);
  return uploadMultipart(`/trips/${tripId}/docs`, formData) as Promise<{ doc: Doc }>;
}

export async function deleteDoc(tripId: string, docId: string) {
  const res = await client.delete(`/trips/${tripId}/docs/${docId}`);
  return res.data as { success: boolean };
}

// ─── 5b. Email Doc Import ─────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'outlook';

export type EmailAttachment = {
  attachmentId: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  emailSubject: string | null;
  emailFrom: string | null;
  emailDate: string | null;
};

export type EmailConnectionStatus = {
  gmail:   { connected: boolean; email: string | null };
  outlook: { connected: boolean; email: string | null };
};

export async function getEmailConnectUrl(provider: EmailProvider) {
  const res = await client.get(`/auth/email/${provider}/connect-url`);
  return res.data as { url: string };
}

export async function getEmailStatus() {
  const res = await client.get('/email-docs/status');
  return res.data as {
    gmail:   { connected: boolean; email: string | null };
    outlook: { connected: boolean; email: string | null };
  };
}

// tripId is optional here — in the Create Trip flow it may not exist yet
export async function listEmailAttachments(provider: EmailProvider, tripId?: string) {
  const res = await client.get('/email-docs/attachments', {
    params: { provider, ...(tripId ? { tripId } : {}) },
  });
  return res.data as { attachments: EmailAttachment[]; total: number };
}

export async function importEmailAttachments(
  tripId: string,
  provider: EmailProvider,
  attachments: Pick<EmailAttachment, 'attachmentId' | 'messageId' | 'fileName'>[],
) {
  const res = await client.post('/email-docs/import', {
    tripId,
    provider,
    attachments: attachments.map(a => ({ ...a, provider })),
  });
  return res.data as {
    imported: { docId: string; fileName: string; fileUrl: string }[];
    failed:   { fileName: string; reason: string }[];
  };
}

export async function disconnectEmailProvider(provider: EmailProvider) {
  const res = await client.delete(`/auth/email/${provider}/disconnect`);
  return res.data as { success: boolean };
}

// ─── 6. Photos ────────────────────────────────────────────────────────────────

export async function getTripPhotos(tripId: string) {
  const res = await client.get(`/trips/${tripId}/photos`);
  return res.data as { photos: Photo[]; total: number };
}

export async function uploadTripPhotos(tripId: string, assets: Array<{ uri: string; type?: string; name?: string }>) {
  const formData = new FormData();
  assets.forEach(asset => {
    formData.append('photos', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.name ?? 'photo.jpg' } as any);
  });
  return uploadMultipart(`/trips/${tripId}/photos`, formData) as Promise<{ photos: Photo[] }>;
}

export async function deleteTripPhoto(tripId: string, photoId: string) {
  const res = await client.delete(`/trips/${tripId}/photos/${photoId}`);
  return res.data as { success: boolean };
}

// ─── 7. Notes ─────────────────────────────────────────────────────────────────

export async function getNotes(tripId: string) {
  const res = await client.get(`/trips/${tripId}/notes`);
  return res.data as { notes: Note[]; total: number };
}

export async function createNote(tripId: string, body: {
  title: string;
  content: string;
  category?: 'general' | 'idea' | 'important' | 'todo';
}) {
  const res = await client.post(`/trips/${tripId}/notes`, body);
  return res.data as { note: Note };
}

export async function updateNote(tripId: string, noteId: string, body: Partial<{
  title: string;
  content: string;
  category: 'general' | 'idea' | 'important' | 'todo';
}>) {
  const res = await client.put(`/trips/${tripId}/notes/${noteId}`, body);
  return res.data as { note: Note };
}

export async function deleteNote(tripId: string, noteId: string) {
  const res = await client.delete(`/trips/${tripId}/notes/${noteId}`);
  return res.data as { success: boolean };
}

export async function favoriteNote(tripId: string, noteId: string) {
  const res = await client.post(`/trips/${tripId}/notes/${noteId}/favorite`);
  return res.data;
}

// ─── 8. Polls ─────────────────────────────────────────────────────────────────

export async function getPolls(tripId: string) {
  const res = await client.get(`/trips/${tripId}/polls`);
  return res.data as { polls: Poll[] };
}

export async function createPoll(tripId: string, body: { question: string; options: string[] }) {
  const res = await client.post(`/trips/${tripId}/polls`, body);
  return res.data as { poll: Poll };
}

export async function voteOnPoll(tripId: string, pollId: string, optionId: string) {
  const res = await client.post(`/trips/${tripId}/polls/${pollId}/vote`, { optionId });
  return res.data as { poll: Poll };
}

// ─── 9. Invite Deep-Link Flow ─────────────────────────────────────────────────

export async function previewTripInvite(token: string) {
  // Public route — no auth header needed
  const res = await client.get(`/trips/invite/${token}`);
  return res.data as { tripId: string; tripName: string; inviterName: string; expiresAt: string };
}

export async function acceptTripInvite(token: string) {
  const res = await client.post(`/trips/invite/${token}/accept`);
  return res.data as { success: boolean; tripId: string };
}

// ─── 10. Friends list (for friend picker in Create Trip / Invite) ─────────────

export async function getFriends(search?: string) {
  const res = await client.get('/friends', { params: search ? { search } : undefined });
  return res.data as {
    friends: {
      connectionId: string;
      user: { id: string; name: string; avatarUrl: string | null; country: string; bio?: string };
      mutualTripCount: number;
      connectedAt: string;
    }[];
    total: number;
  };
}
