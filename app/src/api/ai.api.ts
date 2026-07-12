import client from './client';
import { animateTextStream } from '../utils/animateTextStream';

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

export type PendingAction = {
  intent: 'create_trip' | 'create_event' | 'update_trip' | 'update_event' | 'add_note' | 'identify_update' | 'none';
  readyToCreate: boolean;
  /** When set, the app renders the structured trip/event planning card inline. */
  showForm?: 'trip' | 'event';
  draft?: Record<string, any>;
  tripId?: string;
  targetTripName?: string;
  eventId?: string;
  targetEventName?: string;
  noteContent?: string;
};

/** A document/photo the user attaches for Swee to read (sent inline as base64). */
export type ChatAttachment = {
  name: string;
  mimeType: string;
  /** base64-encoded file contents (no data: prefix). */
  data: string;
};

export type ExecuteResult = {
  reply: string;
  created: { id: string; type: 'trip' | 'event'; name: string } | null;
};

export type ConversationCategory = 'trip' | 'event' | 'general' | 'content';

export type AiConversation = {
  id: string;
  title: string;
  preview: string;
  category: ConversationCategory;
  updatedAt: string;
  createdAt?: string;
  tripContext?: TripContext | null;
};

export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    pendingAction?: PendingAction;
    createdResult?: ExecuteResult['created'];
  };
  createdAt: string;
};

export type ChatDoneResult = {
  pendingAction: PendingAction | null;
  conversationId: string | null;
  messageId: string | null;
};

export type ConversationListResponse = {
  conversations: AiConversation[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type ConversationMessagesResponse = {
  messages: AiMessage[];
  hasMore: boolean;
  nextBefore: string | null;
};

/** Per-character delay for Swee reply typing (slightly faster than welcome). */
const REPLY_CHAR_MS = 22;

/** User-facing copy when Swee or usage limits are hit. */
function resolveSweeChatError(err: any): string {
  const data = err?.response?.data;
  const serverMsg: string = data?.message ?? '';
  if (serverMsg.trim()) return serverMsg;

  const code: string = data?.error ?? '';
  switch (code) {
    case 'GeminiRateLimit':
      return 'Swee is handling many requests at once. Please wait about a minute and try again — this is a temporary AI limit.';
    case 'UserHourlyLimit':
      return "You've reached Swee's hourly message limit. Please wait a bit before sending more.";
    case 'UserDailyLimit':
      return "You've reached Swee's daily message limit. Come back tomorrow to continue — your chats are saved.";
    case 'ServiceBusy':
      return 'Swee is temporarily unavailable due to high demand. Please try again in a couple of minutes.';
    default:
      break;
  }

  const msg: string = err?.message ?? '';
  if (msg.toLowerCase().includes('cancel')) return 'Request cancelled.';
  return 'Network error. Please try again.';
}

export async function listConversations(page = 1, limit = 20): Promise<ConversationListResponse> {
  const response = await client.get('/ai/conversations', { params: { page, limit } });
  return response.data as ConversationListResponse;
}

export async function createConversation(tripContext?: TripContext | null): Promise<AiConversation> {
  const response = await client.post('/ai/conversations', {
    tripContext: tripContext ?? undefined,
  });
  return response.data as AiConversation;
}

export async function getConversation(conversationId: string): Promise<AiConversation> {
  const response = await client.get(`/ai/conversations/${conversationId}`);
  return response.data as AiConversation;
}

export async function getConversationMessages(
  conversationId: string,
  opts?: { before?: string; limit?: number },
): Promise<ConversationMessagesResponse> {
  const response = await client.get(`/ai/conversations/${conversationId}/messages`, {
    params: opts,
  });
  return response.data as ConversationMessagesResponse;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await client.delete(`/ai/conversations/${conversationId}`);
}

export function sendMessageStream(
  message: string,
  conversationId: string | null,
  history: ConversationMessage[],
  tripContext: TripContext | null,
  onPartial: (partial: string) => void,
  onDone: (result: ChatDoneResult) => void,
  onError: (err: string) => void,
  attachments?: ChatAttachment[],
): () => void {
  let aborted = false;
  let cancelAnim: (() => void) | null = null;

  (async () => {
    try {
      const response = await client.post('/ai/chat', {
        message,
        conversationId: conversationId ?? undefined,
        conversationHistory: history,
        tripContext: tripContext ?? undefined,
        attachments: attachments && attachments.length ? attachments : undefined,
      }, { timeout: 90000 });

      if (aborted) return;

      const reply: string = response.data?.reply ?? '';
      const pendingAction: PendingAction | null = response.data?.pendingAction ?? null;
      const resolvedConversationId: string | null = response.data?.conversationId ?? conversationId;
      const messageId: string | null = response.data?.messageId ?? null;

      if (!reply) {
        onError('Swee returned an empty response. Please try again.');
        return;
      }

      if (!reply.trim()) {
        onPartial('');
        onDone({ pendingAction, conversationId: resolvedConversationId, messageId });
        return;
      }

      cancelAnim = animateTextStream(
        reply,
        (partial, done) => {
          if (aborted) return;
          onPartial(partial);
          if (done) {
            onDone({ pendingAction, conversationId: resolvedConversationId, messageId });
          }
        },
        REPLY_CHAR_MS,
      );

    } catch (err: any) {
      if (!aborted) {
        onError(resolveSweeChatError(err));
      }
    }
  })();

  return () => {
    aborted = true;
    cancelAnim?.();
  };
}

/**
 * Execute a confirmed Swee action (create/update trip or event).
 * Called when the user taps the Yes/Confirm chip after a recap.
 */
export async function executeAction(
  pendingAction: PendingAction,
  conversationId?: string | null,
): Promise<ExecuteResult> {
  const response = await client.post('/ai/execute', {
    pendingAction,
    conversationId: conversationId ?? undefined,
  }, { timeout: 30000 });
  return response.data as ExecuteResult;
}

/**
 * Report a Swee response issue.
 */
export async function reportMessage(messageId: string, reason: string): Promise<void> {
  await client.post('/ai/report', { messageId, reason });
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
 * Upsert per-user gallery presentation for a trip/event album (subtitle, hideTravelers).
 */
export async function upsertGalleryItemMeta(
  parentType: 'trip' | 'event',
  parentId: string,
  patch: { subtitle?: string | null; hideTravelers?: boolean },
): Promise<{ subtitle: string | null; hideTravelers: boolean }> {
  const res = await client.patch(
    `/users/me/gallery-items/${parentType}/${parentId}/subtitle`,
    patch,
  );
  return res.data;
}

/** @deprecated Use upsertGalleryItemMeta */
export async function upsertGallerySubtitle(
  parentType: 'trip' | 'event',
  parentId: string,
  subtitle: string | null,
): Promise<{ subtitle: string | null }> {
  return upsertGalleryItemMeta(parentType, parentId, { subtitle });
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
