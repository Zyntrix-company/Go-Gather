import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'swee_chat_draft:';

function draftKey(conversationId: string | null | undefined): string {
  return `${PREFIX}${conversationId ?? 'new'}`;
}

export async function loadChatDraft(conversationId: string | null | undefined): Promise<string> {
  try {
    return (await AsyncStorage.getItem(draftKey(conversationId))) ?? '';
  } catch {
    return '';
  }
}

export async function saveChatDraft(
  conversationId: string | null | undefined,
  text: string,
): Promise<void> {
  try {
    const key = draftKey(conversationId);
    if (!text.trim()) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, text);
    }
  } catch {
    // non-blocking — draft is a convenience, not critical
  }
}

export async function clearChatDraft(conversationId: string | null | undefined): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(conversationId));
  } catch {
    // ignore
  }
}
