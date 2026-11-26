import { getRecentConversation, type AiConversation, type TripContext } from '../api/ai.api';

type ChatNavigation = { navigate: (name: 'ChatDetail', params: Record<string, unknown>) => void };

let opening = false;

/**
 * What the Swee floating button does: reopen the latest chat if the backend says one is
 * still recent (see RESUME_WINDOW_HOURS there), otherwise start a new chat.
 * On a trip/event screen only a chat about that same trip/event is reopened.
 * Any failure (offline, timeout) just starts a new chat, so the button never gets stuck.
 */
export async function openSweeChat(navigation: ChatNavigation, tripContext?: TripContext | null) {
  if (opening) return; // ignore double taps while we look
  opening = true;
  try {
    let recent: AiConversation | null = null;
    try {
      const scope = tripContext?.id && tripContext.contextType
        ? { contextType: tripContext.contextType, contextId: tripContext.id }
        : undefined;
      recent = await getRecentConversation(scope);
    } catch {
      recent = null;
    }
    if (recent) navigation.navigate('ChatDetail', { conversationId: recent.id });
    else navigation.navigate('ChatDetail', tripContext ? { tripContext } : {});
  } finally {
    opening = false;
  }
}
