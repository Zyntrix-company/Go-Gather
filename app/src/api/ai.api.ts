import client from './client';

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type TripContext = {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  memberCount?: number;
  contextType?: 'trip' | 'event';
};

// Structured action extracted from Swee's response after a recap is shown.
// readyToCreate === true means the user just needs to say "Yes" for Swee to act.
export type PendingAction = {
  intent: 'create_trip' | 'create_event' | 'update_trip' | 'update_event' | 'add_note' | 'identify_update' | 'none';
  readyToCreate: boolean;
  draft?: Record<string, any>;
  tripId?: string;
  targetTripName?: string;
  eventId?: string;
  targetEventName?: string;
  noteContent?: string;
};

export type ExecuteResult = {
  reply: string;
  created: { id: string; type: 'trip' | 'event'; name: string } | null;
};

/**
 * Send a message to Swee.
 * Uses the axios client (auto-refreshes expired tokens via interceptor).
 * Simulates word-by-word display locally so the UI still feels animated.
 * Returns an abort function to cancel both the request and the animation.
 *
 * onDone receives the pendingAction from the backend (non-null when Swee
 * is showing a recap and waiting for explicit confirmation).
 */
export function sendMessageStream(
  message: string,
  history: ConversationMessage[],
  tripContext: TripContext | null,
  onDelta: (delta: string) => void,
  onDone: (pendingAction: PendingAction | null) => void,
  onError: (err: string) => void,
): () => void {
  let aborted = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  (async () => {
    try {
      const response = await client.post('/ai/chat', {
        message,
        conversationHistory: history,
        tripContext: tripContext ?? undefined,
      }, { timeout: 60000 });

      if (aborted) return;

      const reply: string = response.data?.reply ?? '';
      const pendingAction: PendingAction | null = response.data?.pendingAction ?? null;

      if (!reply) {
        onError('Swee returned an empty response. Please try again.');
        return;
      }

      // Simulate word-by-word animation locally
      const words = reply.split(' ');
      const WORD_DELAY_MS = 40;

      words.forEach((word, i) => {
        const t = setTimeout(() => {
          if (!aborted) {
            onDelta((i === 0 ? '' : ' ') + word);
          }
        }, i * WORD_DELAY_MS);
        timers.push(t);
      });

      const doneTimer = setTimeout(() => {
        if (!aborted) onDone(pendingAction);
      }, words.length * WORD_DELAY_MS + 50);
      timers.push(doneTimer);

    } catch (err: any) {
      if (!aborted) {
        const msg: string = err?.response?.data?.message ?? err?.message ?? '';
        onError(msg.toLowerCase().includes('cancel') ? 'Request cancelled.' : 'Network error. Please try again.');
      }
    }
  })();

  return () => {
    aborted = true;
    timers.forEach(clearTimeout);
  };
}

/**
 * Execute a confirmed Swee action (create/update trip or event).
 * Called when the user taps the Yes/Confirm chip after a recap.
 */
export async function executeAction(pendingAction: PendingAction): Promise<ExecuteResult> {
  const response = await client.post('/ai/execute', { pendingAction }, { timeout: 30000 });
  return response.data as ExecuteResult;
}

/**
 * Report a Swee response issue.
 */
export async function reportMessage(messageId: string, reason: string): Promise<void> {
  await client.post('/ai/report', { messageId, reason });
}

/**
 * Clear conversation history (server acknowledges; client clears local state).
 */
export async function clearConversation(userId: string): Promise<void> {
  await client.delete(`/ai/chat/${userId}`);
}

/**
 * Fetch user gallery (trips + events with photo counts + optional gallerySubtitle).
 */
export type GalleryAlbumsBySection = {
  trip: any[];
  event: any[];
};

export async function getUserGallery(userId: string): Promise<{
  trips: any[];
  events: any[];
  customAlbums?: GalleryAlbumsBySection;
}> {
  try {
    const res = await client.get(`/users/${userId}/gallery`);
    const data = res.data ?? {};
    return {
      trips: data.trips ?? [],
      events: data.events ?? [],
      customAlbums: data.customAlbums ?? { trip: [], event: [] },
    };
  } catch {
    return { trips: [], events: [], customAlbums: { trip: [], event: [] } };
  }
}

/**
 * Upsert a per-user subtitle for a trip/event gallery tile (owner only).
 * Pass subtitle = null or '' to clear it.
 */
export async function upsertGallerySubtitle(
  parentType: 'trip' | 'event',
  parentId: string,
  subtitle: string | null,
): Promise<{ subtitle: string | null }> {
  const res = await client.patch(
    `/users/me/gallery-items/${parentType}/${parentId}/subtitle`,
    { subtitle },
  );
  return res.data;
}

export async function getArchivedUserGallery(): Promise<{
  trips: any[];
  events: any[];
  customAlbums?: GalleryAlbumsBySection;
}> {
  try {
    const res = await client.get('/users/me/gallery/archived');
    const data = res.data ?? {};
    return {
      trips: data.trips ?? [],
      events: data.events ?? [],
      customAlbums: data.customAlbums ?? { trip: [], event: [] },
    };
  } catch {
    return { trips: [], events: [], customAlbums: { trip: [], event: [] } };
  }
}

export async function archiveGalleryItem(parentType: 'trip' | 'event', parentId: string) {
  const res = await client.post(`/users/me/gallery-items/${parentType}/${parentId}/archive`);
  return res.data;
}

export async function unarchiveGalleryItem(parentType: 'trip' | 'event', parentId: string) {
  const res = await client.post(`/users/me/gallery-items/${parentType}/${parentId}/unarchive`);
  return res.data;
}

/**
 * Fetch photos for a user's gallery, grouped by trip/event + activity.
 * When parentType + parentId are supplied the backend returns ALL photos for that specific
 * trip/event (verifying the user is a member) — used by the friend-gallery modal.
 * Without those params it falls back to photos uploaded by that user across all parents.
 */
export async function getUserPhotos(
  userId: string,
  opts?: { parentType?: 'trip' | 'event'; parentId?: string },
): Promise<{ trips: any[]; events: any[] }> {
  try {
    const params: Record<string, string> = {};
    if (opts?.parentType) params.parentType = opts.parentType;
    if (opts?.parentId)   params.parentId   = opts.parentId;
    const res = await client.get(`/users/${userId}/photos`, {
      params: Object.keys(params).length ? params : undefined,
    });
    return res.data;
  } catch {
    return { trips: [], events: [] };
  }
}
