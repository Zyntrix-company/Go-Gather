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

/**
 * Send a message to Swee.
 * Uses the axios client (auto-refreshes expired tokens via interceptor).
 * Simulates word-by-word display locally so the UI still feels animated.
 * Returns an abort function to cancel both the request and the animation.
 */
export function sendMessageStream(
  message: string,
  history: ConversationMessage[],
  tripContext: TripContext | null,
  onDelta: (delta: string) => void,
  onDone: () => void,
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

      if (!reply) {
        onError('Swee returned an empty response. Please try again.');
        return;
      }

      // Simulate word-by-word animation locally
      const words = reply.split(' ');
      const WORD_DELAY_MS = 40; // ~25 words/sec — feels natural

      words.forEach((word, i) => {
        const t = setTimeout(() => {
          if (!aborted) {
            onDelta((i === 0 ? '' : ' ') + word);
          }
        }, i * WORD_DELAY_MS);
        timers.push(t);
      });

      // Call onDone after last word
      const doneTimer = setTimeout(() => {
        if (!aborted) onDone();
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
export async function getUserGallery(userId: string): Promise<{ trips: any[]; events: any[] }> {
  try {
    const res = await client.get(`/users/${userId}/gallery`);
    return res.data;
  } catch {
    return { trips: [], events: [] };
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

/**
 * Fetch all photos uploaded by a user, grouped by trip/event + activity.
 * Does not require trip/event membership — any authenticated user can call this.
 * Used to display another user's gallery photos without needing to be a trip member.
 */
export async function getUserPhotos(userId: string): Promise<{ trips: any[]; events: any[] }> {
  try {
    const res = await client.get(`/users/${userId}/photos`);
    return res.data;
  } catch {
    return { trips: [], events: [] };
  }
}
