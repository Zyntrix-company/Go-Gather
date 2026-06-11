import { create } from 'zustand';
import {
  listConversations,
  type AiConversation,
} from '../api/ai.api';

type ChatState = {
  conversations: AiConversation[];
  page: number;
  hasMore: boolean;
  loading: boolean;

  fetchConversations: (reset?: boolean) => Promise<void>;
  prependConversation: (conversation: AiConversation) => void;
  updateConversation: (id: string, patch: Partial<AiConversation>) => void;
  removeConversation: (id: string) => void;
  clearConversations: () => void;
};

const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  page: 1,
  hasMore: true,
  loading: false,

  fetchConversations: async (reset = false) => {
    const { page, loading, hasMore } = get();
    if (loading) return;
    if (!reset && !hasMore) return;

    const nextPage = reset ? 1 : page;
    set({ loading: true });

    try {
      const data = await listConversations(nextPage);
      set((state) => ({
        conversations: reset
          ? data.conversations
          : [...state.conversations, ...data.conversations],
        page: data.page + 1,
        hasMore: data.hasMore,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  prependConversation: (conversation) =>
    set((state) => ({
      conversations: [
        conversation,
        ...state.conversations.filter((c) => c.id !== conversation.id),
      ],
    })),

  updateConversation: (id, patch) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  clearConversations: () => set({ conversations: [], page: 1, hasMore: true }),
}));

export default useChatStore;
